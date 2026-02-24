# API Collection Generator

Generate **Postman-compatible** API collections from Swagger / OpenAPI documentation.  
Designed for **NestJS** applications but works with any OpenAPI 3.x / Swagger 2.0 spec.

## Features

- **All HTTP methods** – GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Request bodies** – `application/json`, `multipart/form-data`, `application/x-www-form-urlencoded`, `text/plain`, `application/xml`
- **Path parameters** – `{id}` → Postman `:id` format with sample values
- **Query parameters** – extracted from Swagger with descriptions and required flags
- **Header parameters** – custom headers from Swagger spec
- **Authentication** – Bearer token, Basic auth, API Key (header/query), OAuth2, OpenID Connect
- **Schema resolution** – full `$ref`, `allOf`, `oneOf`, `anyOf` support with sample generation
- **Response examples** – auto-generated response bodies from schemas
- **Folder grouping** – by Swagger tags (default) or first path segment
- **Configurable** – base URL, output path, collection name, and more
- **Collection variables** – `{{base_url}}`, `{{access_token}}`, `{{api_key}}`, etc.

## Installation

```bash
npm install api-collections-generator
```

## Usage (NestJS)

### Basic

```ts
import GenerateAPICollection from "api-collections-generator";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const config = new DocumentBuilder()
  .setTitle("Your API")
  .setDescription("API description")
  .setVersion("1.0")
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api", app, document);

const generator = new GenerateAPICollection(document);
generator.generateAPICollection();
// → writes collection.json to your project root
```

### With Options

```ts
const generator = new GenerateAPICollection(document, {
  baseUrl: "http://localhost:4000", // default: "http://localhost:3000"
  outputPath: "postman/my-api.json", // default: "collection.json"
  collectionName: "My Service API", // default: extracted from Swagger info.title
  groupByTags: true, // default: true (false = group by path segment)
  includeResponses: true, // default: true
});
generator.generateAPICollection();
```

### Options Reference

| Option             | Type      | Default                   | Description                                  |
| ------------------ | --------- | ------------------------- | -------------------------------------------- |
| `baseUrl`          | `string`  | `"http://localhost:3000"` | Base URL prepended to every request          |
| `outputPath`       | `string`  | `"collection.json"`       | Output file path relative to `process.cwd()` |
| `collectionName`   | `string`  | Swagger `info.title`      | Name shown in Postman                        |
| `groupByTags`      | `boolean` | `true`                    | Group requests into folders by Swagger tags  |
| `includeResponses` | `boolean` | `true`                    | Include example responses in collection      |

## Output

A **Postman Collection v2.1.0** JSON file importable via **Postman → Import → Raw text / File**.

The collection includes:

- Folders organised by tag (or path)
- Pre-filled request bodies with realistic sample values
- Path and query parameters with descriptions
- Auth headers derived from your Swagger security schemes
- Collection-level variables for easy environment switching

## Supported Swagger / OpenAPI Features

| Feature                           | Support                                |
| --------------------------------- | -------------------------------------- |
| OpenAPI 3.x paths                 | Yes                                    |
| Swagger 2.0 paths                 | Yes                                    |
| `$ref` schema references          | Yes (recursive)                        |
| `allOf` / `oneOf` / `anyOf`       | Yes                                    |
| `enum` values                     | Yes (first value used)                 |
| `example` / `default` values      | Yes                                    |
| Nested objects & arrays           | Yes                                    |
| File uploads (`binary`)           | Yes (form-data)                        |
| Security schemes                  | Bearer, Basic, API Key, OAuth2, OpenID |
| Global & operation-level security | Yes                                    |
| Tags-based grouping               | Yes                                    |
| Path-level parameters             | Yes                                    |

## License

ISC
