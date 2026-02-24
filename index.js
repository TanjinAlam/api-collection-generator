"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// All HTTP methods supported by OpenAPI / Swagger
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
// ─── Main Class ──────────────────────────────────────────────────────────────
class GenerateAPICollection {
    constructor(document, options = {}) {
        this.folders = new Map();
        this.resolvedSchemaCache = new Map();
        this.document = document;
        const parsedUrl = this.parseBaseUrl(options.baseUrl || "http://localhost:3000");
        this.options = {
            baseUrl: options.baseUrl || "http://localhost:3000",
            outputPath: options.outputPath || "collection.json",
            collectionName: options.collectionName ||
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
    resolveRef(ref) {
        if (this.resolvedSchemaCache.has(ref)) {
            return this.resolvedSchemaCache.get(ref);
        }
        const parts = ref.replace(/^#\//, "").split("/");
        let current = this.document;
        for (const part of parts) {
            if (current && typeof current === "object" && part in current) {
                current = current[part];
            }
            else {
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
    resolveSchemaDeep(schema) {
        if (!schema || typeof schema !== "object")
            return schema;
        // Direct $ref
        if (schema.$ref) {
            return this.resolveRef(schema.$ref);
        }
        // allOf – merge all schemas
        if (schema.allOf && Array.isArray(schema.allOf)) {
            let merged = { type: "object", properties: {} };
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
            const resolvedProps = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                resolvedProps[key] = this.resolveSchemaDeep(value);
            }
            return Object.assign(Object.assign({}, schema), { properties: resolvedProps });
        }
        // Array items
        if (schema.type === "array" && schema.items) {
            return Object.assign(Object.assign({}, schema), { items: this.resolveSchemaDeep(schema.items) });
        }
        return schema;
    }
    /**
     * Generates a sample value from a resolved schema for use in request bodies.
     */
    generateSampleFromSchema(schema) {
        if (!schema)
            return {};
        const resolved = this.resolveSchemaDeep(schema);
        return this.buildSample(resolved);
    }
    buildSample(schema) {
        if (!schema)
            return {};
        // Use example/default if provided
        if (schema.example !== undefined)
            return schema.example;
        if (schema.default !== undefined)
            return schema.default;
        // Enum → first value
        if (schema.enum && schema.enum.length > 0)
            return schema.enum[0];
        switch (schema.type) {
            case "string":
                if (schema.format === "date-time")
                    return "2026-01-01T00:00:00.000Z";
                if (schema.format === "date")
                    return "2026-01-01";
                if (schema.format === "email")
                    return "user@example.com";
                if (schema.format === "uuid")
                    return "550e8400-e29b-41d4-a716-446655440000";
                if (schema.format === "uri" || schema.format === "url")
                    return "https://example.com";
                if (schema.format === "password")
                    return "password123";
                if (schema.format === "binary")
                    return "";
                return "string";
            case "number":
            case "integer":
                if (schema.minimum !== undefined)
                    return schema.minimum;
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
                    const obj = {};
                    for (const [key, propSchema] of Object.entries(schema.properties)) {
                        obj[key] = this.buildSample(propSchema);
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
    parseBaseUrl(baseUrl) {
        try {
            const url = new URL(baseUrl);
            return {
                protocol: url.protocol.replace(":", ""),
                host: url.hostname.split("."),
                port: url.port || (url.protocol === "https:" ? "443" : "80"),
            };
        }
        catch (_a) {
            return { protocol: "http", host: ["localhost"], port: "3000" };
        }
    }
    /**
     * Convert Swagger path params `{id}` to Postman format `:id`
     */
    toPostmanPath(endpoint) {
        return endpoint.replace(/\{([^}]+)\}/g, ":$1");
    }
    buildPostmanUrl(endpoint, queryParams, pathVariables) {
        const parsed = this.parseBaseUrl(this.options.baseUrl);
        const postmanPath = this.toPostmanPath(endpoint);
        let raw = `${this.options.baseUrl}${postmanPath}`;
        if (queryParams.length > 0) {
            const qs = queryParams.map((q) => `${q.key}=${q.value}`).join("&");
            raw += `?${qs}`;
        }
        const url = {
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
    extractParameters(pathParams, operationParams) {
        const queryParams = [];
        const pathVariables = [];
        const headers = [];
        const cookieParams = [];
        // Merge path-level and operation-level params (operation takes precedence)
        const paramMap = new Map();
        for (const p of pathParams || []) {
            const resolved = p.$ref ? this.resolveRef(p.$ref) : p;
            if (resolved)
                paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
        }
        for (const p of operationParams || []) {
            const resolved = p.$ref ? this.resolveRef(p.$ref) : p;
            if (resolved)
                paramMap.set(`${resolved.in}:${resolved.name}`, resolved);
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
    buildRequestBody(requestBody) {
        if (!requestBody)
            return undefined;
        // Resolve $ref on requestBody itself
        const body = requestBody.$ref ? this.resolveRef(requestBody.$ref) : requestBody;
        if (!body || !body.content)
            return undefined;
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
            const formdata = [];
            if (resolved && resolved.properties) {
                for (const [key, propSchema] of Object.entries(resolved.properties)) {
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
            const urlencoded = [];
            if (resolved && resolved.properties) {
                for (const [key, propSchema] of Object.entries(resolved.properties)) {
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
    buildAuth(operationSecurity, headers) {
        var _a;
        // Use operation-level security, fall back to global security
        const security = operationSecurity || this.document.security;
        if (!security || security.length === 0)
            return undefined;
        const securitySchemes = ((_a = this.document.components) === null || _a === void 0 ? void 0 : _a.securitySchemes) ||
            this.document.securityDefinitions || // Swagger 2.0
            {};
        for (const secItem of security) {
            for (const schemeName of Object.keys(secItem)) {
                const scheme = securitySchemes[schemeName];
                if (!scheme)
                    continue;
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
                    }
                    else if (schemeIn === "query") {
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
    buildResponses(responses, method, endpointName) {
        if (!this.options.includeResponses || !responses)
            return [];
        const postmanResponses = [];
        for (const [statusCode, responseObj] of Object.entries(responses)) {
            const resolved = responseObj.$ref ? this.resolveRef(responseObj.$ref) : responseObj;
            if (!resolved)
                continue;
            const response = {
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
    getStatusText(code) {
        const map = {
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
    getFolderName(endpoint, tags) {
        if (this.options.groupByTags && tags && tags.length > 0) {
            return tags[0];
        }
        // Fall back to first path segment
        const segments = endpoint.split("/").filter(Boolean);
        return segments[0] || "default";
    }
    addToFolder(folderName, item, description) {
        if (!this.folders.has(folderName)) {
            this.folders.set(folderName, {
                name: folderName,
                item: [],
                description: description || "",
            });
        }
        this.folders.get(folderName).item.push(item);
    }
    // ─── Main Generation ────────────────────────────────────────────────────
    /**
     * Processes a single operation (one HTTP method on one path).
     */
    processOperation(endpoint, method, operation, pathLevelParams) {
        var _a, _b, _c, _d;
        // Extract parameters
        const { queryParams, pathVariables, headers, cookieParams } = this.extractParameters(pathLevelParams, operation.parameters);
        // Build URL
        const url = this.buildPostmanUrl(endpoint, queryParams, pathVariables);
        // Build headers – always add Content-Type for methods that send a body
        const requestHeaders = [...headers];
        const methodUpper = method.toUpperCase();
        // Build auth
        const auth = this.buildAuth(operation.security, requestHeaders);
        // Build request body
        const body = this.buildRequestBody(operation.requestBody);
        // If there's a JSON body, add Content-Type header
        if (body && body.mode === "raw" && ((_b = (_a = body.options) === null || _a === void 0 ? void 0 : _a.raw) === null || _b === void 0 ? void 0 : _b.language) === "json") {
            const hasContentType = requestHeaders.some((h) => h.key.toLowerCase() === "content-type");
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
        const request = {
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
        const item = {
            name: displayName,
            request,
            response: responses,
        };
        // Add to folder
        const folderName = this.getFolderName(endpoint, operation.tags);
        const folderDesc = ((_d = (_c = this.document.tags) === null || _c === void 0 ? void 0 : _c.find((t) => t.name === folderName)) === null || _d === void 0 ? void 0 : _d.description) || "";
        this.addToFolder(folderName, item, folderDesc);
    }
    /**
     * Build collection-level auth from global security schemes.
     */
    buildCollectionAuth() {
        var _a;
        const securitySchemes = ((_a = this.document.components) === null || _a === void 0 ? void 0 : _a.securitySchemes) ||
            this.document.securityDefinitions ||
            {};
        // Check for bearer auth as the most common default
        for (const [, scheme] of Object.entries(securitySchemes)) {
            if (scheme.type === "http" &&
                scheme.scheme &&
                scheme.scheme.toLowerCase() === "bearer") {
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
    buildCollectionVariables() {
        const parsed = this.parseBaseUrl(this.options.baseUrl);
        const variables = [
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
    generateAPICollection() {
        var _a;
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
        const collection = {
            info: {
                name: this.options.collectionName,
                description: ((_a = this.document.info) === null || _a === void 0 ? void 0 : _a.description) || "",
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
        console.log(`✅ Postman collection generated: ${filePath} (${collection.item.length} folders, ${collection.item.reduce((sum, f) => sum + f.item.length, 0)} requests)`);
    }
}
exports.default = GenerateAPICollection;
//# sourceMappingURL=index.js.map