# API Collection Generator

API Collection Generator is a tool for generating API collections from Swagger documentation.

This package is speically designed for NestJs Application.

## Installation

To use the API Collection Generator, you can install it via npm:

## Installation

```bash
npm install api-collections-generator
```

# api-collections-generator

**Example How To Use It Within Nestjs Main.ts**

```js
import GenerateAPICollection from "api-collections-generator";
const config = new DocumentBuilder()
  .setTitle("Your API")
  .setDescription("API description")
  .setVersion("1.0")
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);

SwaggerModule.setup("api", app, document);

const apiCollectionGenerator = new GenerateAPICollection(document);
apiCollectionGenerator.generateAPICollection();
```

## Output

You will have a **collection.json** at your application base directory.
