import * as fs from "fs";
import * as path from "path";
class GenerateAPICollection {
  document: any;
  item: any = [];
  constructor(document) {
    this.document = document;
  }

  replaceSchemaWithMetadata(schemaName: string, metadata: object) {
    this.item.forEach((group) => {
      // console.log(JSON.stringify(group, null, 2))
      group.item.forEach((element) => {
        if (
          element.request.url &&
          element.request.url.schemaName == schemaName
        ) {
          // console.log(
          //     element.request.url.schemaName,
          //     schemaName,
          //     metadata
          // )

          // delete element.request.url.schemaName
          if (element.request.method == "POST") {
            delete element.request.url.schemaName;
            element.request["body"] = {
              mode: "raw",
              raw: JSON.stringify(metadata, null, 2),
              options: {
                raw: {
                  language: "json",
                },
              },
            };
          } else if (element.request.method == "GET") {
            delete element.request.url.schemaName;
            element.request["body"] = {
              mode: "raw",
              raw: JSON.stringify(metadata, null, 2),
              options: {
                raw: {
                  language: "json",
                },
              },
            };
          } else if (element.request.method == "PATCH") {
            delete element.request.url.schemaName;
            element.request["body"] = {
              mode: "raw",
              raw: JSON.stringify(metadata, null, 2),
              options: {
                raw: {
                  language: "json",
                },
              },
            };
          } else if (element.request.method == "DELETE") {
            delete element.request.url.schemaName;
            element.request["body"] = {
              mode: "raw",
              raw: JSON.stringify(metadata, null, 2),
              options: {
                raw: {
                  language: "json",
                },
              },
            };
          }
          // item.request.url.schemaName = metadata
        }
      });
    });
  }

  aggrigateDTOMetadata() {
    const routess = this.document.components;
    for (const key in this.document.components) {
      if (Object.hasOwnProperty.call(routess, key)) {
        // console.log(`Key: ${key}`)
        const subObject = routess[key];

        for (const subKey in subObject) {
          if (Object.hasOwnProperty.call(subObject, subKey)) {
            const tempDTOObject = {};
            const value = subObject[subKey];
            if (subKey == "bearer") continue;
            // console.log(`  SubKey: ${subKey}, Value:`, value)
            // console.log('value', value)

            for (const schemaKey in value) {
              if (Object.hasOwnProperty.call(value, schemaKey)) {
                const schemaValue = value[schemaKey];

                // // Extract and print the subkey (schema name)
                // console.log(`  Schema Name: ${schemaKey}`);

                if (schemaKey === "properties") {
                  for (const propKey in schemaValue) {
                    if (Object.hasOwnProperty.call(schemaValue, propKey)) {
                      const propValue = schemaValue[propKey];
                      // console.log(
                      //     `    Property: ${propKey}, Type: ${propValue.type}`
                      // )
                      tempDTOObject[propKey] = propValue.type;
                    }
                  }
                }
              }
            }
            this.replaceSchemaWithMetadata(subKey, tempDTOObject);
          }
        }
      }
    }
  }

  checkRootNameExist(name: string) {
    if (this.item.length == 0) {
      return false;
    } else {
      return this.item.some((element) => element.name === name);
      // item.forEach((group) => {
      //     group.item.forEach((item) => {
      //         // console.log('item=========', item)
      //     })
      // })
      // return false
    }
  }
  createNewName(name: string, newItem: object) {
    this.item.push({
      name: name,
      item: [newItem],
    });
  }
  insertInExistingName(name: string, newItem: object) {
    this.item.map((element, index) => {
      if (element.name == name) {
        this.item[index].item.push(newItem);
      }
    });
  }

  processComponents() {
    for (const endpoint in this.document.paths) {
      if (this.document.paths[endpoint].post) {
        const tempRequestData = {
          name: endpoint,
          request: {
            method: "POST",
            url: {
              raw: `http://localhost:3000/${endpoint}`,
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
          response: [],
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)

        // check controller endpoint exist or not
        const value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);

        const postRequestBody = this.document.paths[endpoint].post.requestBody;

        if (
          postRequestBody &&
          postRequestBody.content &&
          postRequestBody.content["application/json"]
        ) {
          const schema = postRequestBody.content["application/json"].schema;
          // console.log('Schema:')

          for (const prop in schema) {
            // console.log(`${prop}:`, schema[prop])
            // console.log(
            //     schema[prop].includes('/')
            //         ? schema[prop].split('/').pop()
            //         : "No '/' characters found"
            // )
            //update the schema name
            tempRequestData.request.url["schemaName"] = schema[prop].includes(
              "/"
            )
              ? schema[prop].split("/").pop()
              : "No '/' characters found";
          }
        }
      }

      if (this.document.paths[endpoint].get) {
        const tempRequestData = {
          name: endpoint,
          request: {
            method: "GET",
            url: {
              raw: `http://localhost:3000/${endpoint}`,
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)

        // check controller endpoint exist or not
        const value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);
        // console.log(
        //     `Get Parameters:`,
        //     this.document[endpoint].get.parameters
        // )
        // console.log(
        //     `Get Responses:`,
        //     this.document[endpoint].get.responses
        // )
      }

      if (this.document.paths[endpoint].patch) {
        const tempRequestData = {
          name: endpoint,
          request: {
            method: "PATCH",
            url: {
              raw: `http://localhost:3000/${endpoint}`,
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)

        // check controller endpoint exist or not
        const value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);

        const patchRequestBody: any =
          this.document.paths[endpoint].patch.requestBody;

        if (
          patchRequestBody &&
          patchRequestBody.content &&
          patchRequestBody.content["application/json"]
        ) {
          const schema = patchRequestBody.content["application/json"].schema;
          for (const prop in schema) {
            tempRequestData.request.url["schemaName"] = schema[prop].includes(
              "/"
            )
              ? schema[prop].split("/").pop()
              : "No '/' characters found";
          }
        }
      }

      if (this.document.paths[endpoint].delete) {
        const tempRequestData = {
          name: endpoint,
          request: {
            method: "DELETE",
            url: {
              raw: `http://localhost:3000/${endpoint}`,
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)
        // check controller endpoint exist or not
        const value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);

        const deleteRequestBody: any =
          this.document.paths[endpoint].delete.requestBody;

        if (
          deleteRequestBody &&
          deleteRequestBody.content &&
          deleteRequestBody.content["application/json"]
        ) {
          const schema = deleteRequestBody.content["application/json"].schema;

          for (const prop in schema) {
            tempRequestData.request.url["schemaName"] = schema[prop].includes(
              "/"
            )
              ? schema[prop].split("/").pop()
              : "No '/' characters found";
          }
        }
      }
    }
    this.aggrigateDTOMetadata();
    const filePath = path.join(process.cwd(), "collection.json");
    const collection = {};
    (collection["info"] = {
      _postman_id: "9fb22a93-fc4b-444f-9b95-f133ee1eff36",
      name: "Generated API Collection",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _exporter_id: "9425169",
      _collection_link:
        "https://www.postman.com/chickensartwork/workspace/working/collection/9425168-9fb22a93-fc4b-444f-9b95-f133ee1eff37?action=share&source=collection_link&creator=9425168",
    }),
      (collection["item"] = this.item);
    // console.log('collection', JSON.stringify(collection, null, 2))
    fs.writeFileSync(filePath, JSON.stringify(collection, null, 2));
  }
}

export default GenerateAPICollection;
