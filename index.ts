import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratorOptions {
  /** Base URL for all requests (default: "http://localhost:3000") */
  baseUrl?: string;
  /** Output file path relative to cwd (default: "collection.json") */
  outputPath?: string;
  /** Collection name (default: extracted from Swagger info.title) */
  collectionName?: string;
  /** Use Swagger tags for folder grouping instead of path segments (default: true) */
  groupByTags?: boolean;
  /** Include example responses in the collection (default: true) */
  includeResponses?: boolean;
}

interface PostmanVariable {
  key: string;
  value: string;
  description?: string;
}

interface PostmanHeader {
  key: string;
  value: string;
  type: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw: string;
  protocol: string;
  host: string[];
  port: string;
  path: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

interface PostmanBody {
  mode: string;
  raw?: string;
  formdata?: Array<{ key: string; value: string; type: string; description?: string }>;
  urlencoded?: Array<{ key: string; value: string; description?: string }>;
  options?: {
    raw?: { language: string };
  };
}

interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: PostmanUrl;
  body?: PostmanBody;
  auth?: any;
  description?: string;
}

interface PostmanItem {
  name: string;
  request: PostmanRequest;
  response: any[];
}

interface PostmanFolder {
  name: string;
  item: PostmanItem[];
  description?: string;
}

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanFolder[];
  auth?: any;
  variable?: PostmanVariable[];
}

// All HTTP methods supported by OpenAPI / Swagger
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

// ─── Main Class ──────────────────────────────────────────────────────────────

class GenerateAPICollection {
  private document: any;
  private options: Required<GeneratorOptions>;
  private folders: Map<string, PostmanFolder> = new Map();
  private resolvedSchemaCache: Map<string, any> = new Map();

  constructor(document: any, options: GeneratorOptions = {}) {
    this.document = document;

    const parsedUrl = this.parseBaseUrl(options.baseUrl || "http://localhost:3000");

    this.options = {
      baseUrl: options.baseUrl || "http://localhost:3000",
      outputPath: options.outputPath || "collection.json",
      collectionName:
        options.collectionName ||
        (document.info && document.info.title) ||
        "Generated API Collection",
      groupByTags: options.groupByTags !== undefined ? options.groupByTags : true,
      includeResponses: options.includeResponses !== undefined ? options.includeResponses : true,
    };
  }

  // ─── Schema Resolution ───────────────────────────────────────────────────

  /**
   * Resolves a `$ref` string like "#/components/schemas/CreateUserDto"
   * into the actual schema object from the document.
   */
  private resolveRef(ref: string): any {
    if (this.resolvedSchemaCache.has(ref)) {
      return this.resolvedSchemaCache.get(ref);
    }

    const parts = ref.replace(/^#\//, "").split("/");
    let current = this.document;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    // Mark as resolving to prevent infinite recursion with circular refs
    this.resolvedSchemaCache.set(ref, current);

    const resolved = this.resolveSchemaDeep(current);
    this.resolvedSchemaCache.set(ref, resolved);
    return resolved;
  }

  /**
   * Recursively resolves a schema, handling $ref, allOf, oneOf, anyOf,
   * nested objects, and arrays.
   */
  private resolveSchemaDeep(schema: any): any {
    if (!schema || typeof schema !== "object") return schema;

    // Direct $ref
    if (schema.$ref) {
      return this.resolveRef(schema.$ref);
    }

    // allOf – merge all schemas
    if (schema.allOf && Array.isArray(schema.allOf)) {
      let merged: any = { type: "object", properties: {} };
      for (const sub of schema.allOf) {
        const resolved = this.resolveSchemaDeep(sub);
        if (resolved && resolved.properties) {
          Object.assign(merged.properties, resolved.properties);
        }
      }
      return merged;
    }

    // oneOf / anyOf – pick the first variant for sample generation
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      return this.resolveSchemaDeep(schema.oneOf[0]);
    }
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      return this.resolveSchemaDeep(schema.anyOf[0]);
    }

    // Resolve properties recursively
    if (schema.properties) {
      const resolvedProps: any = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        resolvedProps[key] = this.resolveSchemaDeep(value as any);
      }
      return { ...schema, properties: resolvedProps };
    }

    // Array items
    if (schema.type === "array" && schema.items) {
      return { ...schema, items: this.resolveSchemaDeep(schema.items) };
    }

    return schema;
  }

  /**
   * Generates a sample value from a resolved schema for use in request bodies.
   */
  private generateSampleFromSchema(schema: any): any {
    if (!schema) return {};

    const resolved = this.resolveSchemaDeep(schema);
    return this.buildSample(resolved);
  }

  private buildSample(schema: any): any {
    if (!schema) return {};

    // Use example/default if provided
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    // Enum → first value
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];

    switch (schema.type) {
      case "string":
        if (schema.format === "date-time") return "2026-01-01T00:00:00.000Z";
        if (schema.format === "date") return "2026-01-01";
        if (schema.format === "email") return "user@example.com";
        if (schema.format === "uuid") return "550e8400-e29b-41d4-a716-446655440000";
        if (schema.format === "uri" || schema.format === "url") return "https://example.com";
        if (schema.format === "password") return "password123";
        if (schema.format === "binary") return "";
        return "string";
      case "number":
      case "integer":
        if (schema.minimum !== undefined) return schema.minimum;
        return 0;
      case "boolean":
        return true;
      case "array":
        if (schema.items) {
          return [this.buildSample(schema.items)];
        }
        return [];
      case "object":
      default:
        if (schema.properties) {
          const obj: any = {};
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            obj[key] = this.buildSample(propSchema as any);
          }
          return obj;
        }
        if (schema.additionalProperties) {
          return { key: this.buildSample(schema.additionalProperties) };
        }
        return {};
    }
  }

  // ─── URL Parsing ─────────────────────────────────────────────────────────

  private parseBaseUrl(baseUrl: string): { protocol: string; host: string[]; port: string } {
    try {
      const url = new URL(baseUrl);
      return {
        protocol: url.protocol.replace(":", ""),
        host: url.hostname.split("."),
        port: url.port || (url.protocol === "https:" ? "443" : "80"),
      };
    } catch {
      return { protocol: "http", host: ["localhost"], port: "3000" };
    }
  }

  /**
   * Convert Swagger path params `{id}` to Postman format `:id`
   */
  private toPostmanPath(endpoint: string): string {
    return endpoint.replace(/\{([^}]+)\}/g, ":$1");
  }

  private buildPostmanUrl(endpoint: string, queryParams: PostmanQueryParam[], pathVariables: PostmanVariable[]): PostmanUrl {
    const parsed = this.parseBaseUrl(this.options.baseUrl);
    const postmanPath = this.toPostmanPath(endpoint);

    let raw = `${this.options.baseUrl}${postmanPath}`;
    if (queryParams.length > 0) {
      const qs = queryParams.map((q) => `${q.key}=${q.value}`).join("&");
      raw += `?${qs}`;
    }

    const url: PostmanUrl = {
      raw,
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      path: postmanPath.split("/").filter(Boolean),
    };

    if (queryParams.length > 0) {
      url.query = queryParams;
    }
    if (pathVariables.length > 0) {
      url.variable = pathVariables;
    }

    return url;
  }

  // ─── Parameters ──────────────────────────────────────────────────────────

  /**
   * Extracts and categorises parameters from the Swagger operation and path-level.
   */
  private extractParameters(
    pathParams: any[] | undefined,
    operationParams: any[] | undefined
  ): {
    queryParams: PostmanQueryParam[];
    pathVariables: PostmanVariable[];
    headers: PostmanHeader[];
    cookieParams: PostmanQueryParam[];
  } {
    const queryParams: PostmanQueryParam[] = [];
    const pathVariables: PostmanVariable[] = [];
    const headers: PostmanHeader[] = [];
    const cookieParams: PostmanQueryParam[] = [];

    // Merge path-level and operation-level params (operation takes precedence)
    const paramMap = new Map<string, any>();
    for (const p of pathParams || []) {
      const resolved = p.$ref ? this.resolveRef(p.$ref) : p;
      if (resolved) paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
    }
    for (const p of operationParams || []) {
      const resolved = p.$ref ? this.resolveRef(p.$ref) : p;
      if (resolved) paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
    }

    for (const param of paramMap.values()) {
      const sampleValue = param.example !== undefined
        ? String(param.example)
        : param.schema
          ? String(this.buildSample(this.resolveSchemaDeep(param.schema)))
          : "";

      const description = param.description || "";

      switch (param.in) {
        case "query":
          queryParams.push({
            key: param.name,
            value: sampleValue,
            description: `${description}${param.required ? " (required)" : ""}`,
            disabled: !param.required,
          });
          break;
        case "path":
          pathVariables.push({
            key: param.name,
            value: sampleValue,
            description,
          });
          break;
        case "header":
          headers.push({
            key: param.name,
            value: sampleValue,
            type: "text",
            description,
          });
          break;
        case "cookie":
          cookieParams.push({
            key: param.name,
            value: sampleValue,
            description,
          });
          break;
      }
    }

    return { queryParams, pathVariables, headers, cookieParams };
  }

  // ─── Request Body ────────────────────────────────────────────────────────

  private buildRequestBody(requestBody: any): PostmanBody | undefined {
    if (!requestBody) return undefined;

    // Resolve $ref on requestBody itself
    const body = requestBody.$ref ? this.resolveRef(requestBody.$ref) : requestBody;
    if (!body || !body.content) return undefined;

    // application/json
    if (body.content["application/json"]) {
      const schema = body.content["application/json"].schema;
      const sample = this.generateSampleFromSchema(schema);
      return {
        mode: "raw",
        raw: JSON.stringify(sample, null, 2),
        options: { raw: { language: "json" } },
      };
    }

    // multipart/form-data
    if (body.content["multipart/form-data"]) {
      const schema = body.content["multipart/form-data"].schema;
      const resolved = this.resolveSchemaDeep(schema);
      const formdata: PostmanBody["formdata"] = [];
      if (resolved && resolved.properties) {
        for (const [key, propSchema] of Object.entries(resolved.properties as Record<string, any>)) {
          const isFile = propSchema.type === "string" && propSchema.format === "binary";
          formdata.push({
            key,
            value: isFile ? "" : String(this.buildSample(propSchema)),
            type: isFile ? "file" : "text",
            description: propSchema.description || "",
          });
        }
      }
      return { mode: "formdata", formdata };
    }

    // application/x-www-form-urlencoded
    if (body.content["application/x-www-form-urlencoded"]) {
      const schema = body.content["application/x-www-form-urlencoded"].schema;
      const resolved = this.resolveSchemaDeep(schema);
      const urlencoded: PostmanBody["urlencoded"] = [];
      if (resolved && resolved.properties) {
        for (const [key, propSchema] of Object.entries(resolved.properties as Record<string, any>)) {
          urlencoded.push({
            key,
            value: String(this.buildSample(propSchema)),
            description: propSchema.description || "",
          });
        }
      }
      return { mode: "urlencoded", urlencoded };
    }

    // text/plain
    if (body.content["text/plain"]) {
      return {
        mode: "raw",
        raw: "",
        options: { raw: { language: "text" } },
      };
    }

    // application/xml
    if (body.content["application/xml"]) {
      return {
        mode: "raw",
        raw: "",
        options: { raw: { language: "xml" } },
      };
    }

    return undefined;
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  /**
   * Builds Postman auth object and/or headers from the Swagger security
   * definitions applied to an operation.
   */
  private buildAuth(
    operationSecurity: any[] | undefined,
    headers: PostmanHeader[]
  ): any | undefined {
    // Use operation-level security, fall back to global security
    const security = operationSecurity || this.document.security;
    if (!security || security.length === 0) return undefined;

    const securitySchemes =
      this.document.components?.securitySchemes ||
      this.document.securityDefinitions || // Swagger 2.0
      {};

    for (const secItem of security) {
      for (const schemeName of Object.keys(secItem)) {
        const scheme = securitySchemes[schemeName];
        if (!scheme) continue;

        const type = (scheme.type || "").toLowerCase();
        const schemeIn = (scheme.in || "").toLowerCase();
        const schemeName2 = scheme.scheme ? scheme.scheme.toLowerCase() : "";

        // Bearer token (http bearer or OAuth2)
        if (type === "http" && schemeName2 === "bearer") {
          return {
            type: "bearer",
            bearer: [
              {
                key: "token",
                value: "{{access_token}}",
                type: "string",
              },
            ],
          };
        }

        // Basic auth
        if (type === "http" && schemeName2 === "basic") {
          return {
            type: "basic",
            basic: [
              { key: "username", value: "{{username}}", type: "string" },
              { key: "password", value: "{{password}}", type: "string" },
            ],
          };
        }

        // API Key
        if (type === "apikey") {
          if (schemeIn === "header") {
            headers.push({
              key: scheme.name || "X-API-Key",
              value: "{{api_key}}",
              type: "text",
              description: "API Key",
            });
          } else if (schemeIn === "query") {
            // Query params are handled separately; we return a marker
            return { type: "apikey", apikey: [{ key: "key", value: scheme.name || "api_key" }, { key: "value", value: "{{api_key}}" }, { key: "in", value: "query" }] };
          }
          return {
            type: "apikey",
            apikey: [
              { key: "key", value: scheme.name || "X-API-Key" },
              { key: "value", value: "{{api_key}}" },
              { key: "in", value: schemeIn || "header" },
            ],
          };
        }

        // OAuth2
        if (type === "oauth2") {
          return {
            type: "bearer",
            bearer: [
              {
                key: "token",
                value: "{{access_token}}",
                type: "string",
              },
            ],
          };
        }

        // OpenID Connect
        if (type === "openidconnect") {
          return {
            type: "bearer",
            bearer: [
              {
                key: "token",
                value: "{{access_token}}",
                type: "string",
              },
            ],
          };
        }
      }
    }

    return undefined;
  }

  // ─── Responses ───────────────────────────────────────────────────────────

  private buildResponses(responses: any, method: string, endpointName: string): any[] {
    if (!this.options.includeResponses || !responses) return [];

    const postmanResponses: any[] = [];

    for (const [statusCode, responseObj] of Object.entries(responses as Record<string, any>)) {
      const resolved = responseObj.$ref ? this.resolveRef(responseObj.$ref) : responseObj;
      if (!resolved) continue;

      const response: any = {
        name: `${resolved.description || statusCode}`,
        originalRequest: null, // Will be filled later if needed
        status: this.getStatusText(statusCode),
        code: parseInt(statusCode, 10) || 0,
        header: [{ key: "Content-Type", value: "application/json" }],
        body: "",
      };

      // Generate response body sample
      if (resolved.content && resolved.content["application/json"] && resolved.content["application/json"].schema) {
        const sample = this.generateSampleFromSchema(resolved.content["application/json"].schema);
        response.body = JSON.stringify(sample, null, 2);
      }

      postmanResponses.push(response);
    }

    return postmanResponses;
  }

  private getStatusText(code: string): string {
    const map: Record<string, string> = {
      "200": "OK",
      "201": "Created",
      "202": "Accepted",
      "204": "No Content",
      "301": "Moved Permanently",
      "302": "Found",
      "304": "Not Modified",
      "400": "Bad Request",
      "401": "Unauthorized",
      "403": "Forbidden",
      "404": "Not Found",
      "405": "Method Not Allowed",
      "409": "Conflict",
      "422": "Unprocessable Entity",
      "429": "Too Many Requests",
      "500": "Internal Server Error",
      "502": "Bad Gateway",
      "503": "Service Unavailable",
    };
    return map[code] || code;
  }

  // ─── Folder Management ──────────────────────────────────────────────────

  private getFolderName(endpoint: string, tags?: string[]): string {
    if (this.options.groupByTags && tags && tags.length > 0) {
      return tags[0];
    }
    // Fall back to first path segment
    const segments = endpoint.split("/").filter(Boolean);
    return segments[0] || "default";
  }

  private addToFolder(folderName: string, item: PostmanItem, description?: string): void {
    if (!this.folders.has(folderName)) {
      this.folders.set(folderName, {
        name: folderName,
        item: [],
        description: description || "",
      });
    }
    this.folders.get(folderName)!.item.push(item);
  }

  // ─── Main Generation ────────────────────────────────────────────────────

  /**
   * Processes a single operation (one HTTP method on one path).
   */
  private processOperation(
    endpoint: string,
    method: HttpMethod,
    operation: any,
    pathLevelParams: any[] | undefined
  ): void {
    // Extract parameters
    const { queryParams, pathVariables, headers, cookieParams } = this.extractParameters(
      pathLevelParams,
      operation.parameters
    );

    // Build URL
    const url = this.buildPostmanUrl(endpoint, queryParams, pathVariables);

    // Build headers – always add Content-Type for methods that send a body
    const requestHeaders: PostmanHeader[] = [...headers];
    const methodUpper = method.toUpperCase();

    // Build auth
    const auth = this.buildAuth(operation.security, requestHeaders);

    // Build request body
    const body = this.buildRequestBody(operation.requestBody);

    // If there's a JSON body, add Content-Type header
    if (body && body.mode === "raw" && body.options?.raw?.language === "json") {
      const hasContentType = requestHeaders.some(
        (h) => h.key.toLowerCase() === "content-type"
      );
      if (!hasContentType) {
        requestHeaders.push({
          key: "Content-Type",
          value: "application/json",
          type: "text",
        });
      }
    }

    // Build consumes-based Accept header if specified
    if (operation.produces && operation.produces.length > 0) {
      requestHeaders.push({
        key: "Accept",
        value: operation.produces[0],
        type: "text",
      });
    }

    // Compose a readable name
    const operationSummary = operation.summary || operation.operationId || "";
    const displayName = operationSummary
      ? `${operationSummary}`
      : `${methodUpper} ${endpoint}`;

    // Description
    const description = [
      operation.description || "",
      operation.summary ? `**Summary:** ${operation.summary}` : "",
      operation.operationId ? `**Operation ID:** ${operation.operationId}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Build request
    const request: PostmanRequest = {
      method: methodUpper,
      header: requestHeaders,
      url,
    };

    if (body) {
      request.body = body;
    }

    if (auth) {
      request.auth = auth;
    }

    if (description) {
      request.description = description;
    }

    // Build responses
    const responses = this.buildResponses(operation.responses, methodUpper, endpoint);

    // Create item
    const item: PostmanItem = {
      name: displayName,
      request,
      response: responses,
    };

    // Add to folder
    const folderName = this.getFolderName(endpoint, operation.tags);
    const folderDesc =
      this.document.tags?.find((t: any) => t.name === folderName)?.description || "";
    this.addToFolder(folderName, item, folderDesc);
  }

  /**
   * Build collection-level auth from global security schemes.
   */
  private buildCollectionAuth(): any | undefined {
    const securitySchemes =
      this.document.components?.securitySchemes ||
      this.document.securityDefinitions ||
      {};

    // Check for bearer auth as the most common default
    for (const [, scheme] of Object.entries(securitySchemes as Record<string, any>)) {
      if (
        scheme.type === "http" &&
        scheme.scheme &&
        scheme.scheme.toLowerCase() === "bearer"
      ) {
        return {
          type: "bearer",
          bearer: [
            {
              key: "token",
              value: "{{access_token}}",
              type: "string",
            },
          ],
        };
      }
    }

    return undefined;
  }

  /**
   * Build collection-level variables for common values.
   */
  private buildCollectionVariables(): PostmanVariable[] {
    const parsed = this.parseBaseUrl(this.options.baseUrl);
    const variables: PostmanVariable[] = [
      { key: "base_url", value: this.options.baseUrl, description: "Base URL for API requests" },
      { key: "access_token", value: "", description: "Bearer token for authentication" },
      { key: "api_key", value: "", description: "API key for authentication" },
      { key: "username", value: "", description: "Username for basic auth" },
      { key: "password", value: "", description: "Password for basic auth" },
    ];
    return variables;
  }

  /**
   * Main entry point – parses the entire Swagger/OpenAPI document and writes
   * a Postman Collection v2.1.0 JSON file.
   */
  generateAPICollection(): void {
    const paths = this.document.paths || {};

    for (const endpoint of Object.keys(paths)) {
      const pathItem = paths[endpoint];
      const pathLevelParams = pathItem.parameters;

      for (const method of HTTP_METHODS) {
        if (pathItem[method]) {
          this.processOperation(endpoint, method, pathItem[method], pathLevelParams);
        }
      }
    }

    // Assemble collection
    const collection: PostmanCollection = {
      info: {
        name: this.options.collectionName,
        description: this.document.info?.description || "",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: Array.from(this.folders.values()),
      variable: this.buildCollectionVariables(),
    };

    const collectionAuth = this.buildCollectionAuth();
    if (collectionAuth) {
      collection.auth = collectionAuth;
    }

    // Write to file
    const filePath = path.join(process.cwd(), this.options.outputPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));

    console.log(
      `✅ Postman collection generated: ${filePath} (${collection.item.length} folders, ${collection.item.reduce((sum, f) => sum + f.item.length, 0)} requests)`
    );
  }
}

export default GenerateAPICollection;
