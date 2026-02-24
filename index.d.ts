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
declare class GenerateAPICollection {
    private document;
    private options;
    private folders;
    private resolvedSchemaCache;
    constructor(document: any, options?: GeneratorOptions);
    /**
     * Resolves a `$ref` string like "#/components/schemas/CreateUserDto"
     * into the actual schema object from the document.
     */
    private resolveRef;
    /**
     * Recursively resolves a schema, handling $ref, allOf, oneOf, anyOf,
     * nested objects, and arrays.
     */
    private resolveSchemaDeep;
    /**
     * Generates a sample value from a resolved schema for use in request bodies.
     */
    private generateSampleFromSchema;
    private buildSample;
    private parseBaseUrl;
    /**
     * Convert Swagger path params `{id}` to Postman format `:id`
     */
    private toPostmanPath;
    private buildPostmanUrl;
    /**
     * Extracts and categorises parameters from the Swagger operation and path-level.
     */
    private extractParameters;
    private buildRequestBody;
    /**
     * Builds Postman auth object and/or headers from the Swagger security
     * definitions applied to an operation.
     */
    private buildAuth;
    private buildResponses;
    private getStatusText;
    private getFolderName;
    private addToFolder;
    /**
     * Processes a single operation (one HTTP method on one path).
     */
    private processOperation;
    /**
     * Build collection-level auth from global security schemes.
     */
    private buildCollectionAuth;
    /**
     * Build collection-level variables for common values.
     */
    private buildCollectionVariables;
    /**
     * Main entry point – parses the entire Swagger/OpenAPI document and writes
     * a Postman Collection v2.1.0 JSON file.
     */
    generateAPICollection(): void;
}
export default GenerateAPICollection;
//# sourceMappingURL=index.d.ts.map