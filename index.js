"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var GenerateAPICollection = /** @class */ (function () {
  function GenerateAPICollection(document) {
    this.item = [];
    this.document = document;
  }
  GenerateAPICollection.prototype.replaceSchemaWithMetadata = function (
    schemaName,
    metadata
  ) {
    this.item.forEach(function (group) {
      // console.log(JSON.stringify(group, null, 2))
      group.item.forEach(function (element) {
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
  };
  GenerateAPICollection.prototype.aggrigateDTOMetadata = function () {
    var routess = this.document.components;
    for (var key in this.document.components) {
      if (Object.hasOwnProperty.call(routess, key)) {
        // console.log(`Key: ${key}`)
        var subObject = routess[key];
        for (var subKey in subObject) {
          if (Object.hasOwnProperty.call(subObject, subKey)) {
            var tempDTOObject = {};
            var value = subObject[subKey];
            if (subKey == "bearer") continue;
            // console.log(`  SubKey: ${subKey}, Value:`, value)
            // console.log('value', value)
            for (var schemaKey in value) {
              if (Object.hasOwnProperty.call(value, schemaKey)) {
                var schemaValue = value[schemaKey];
                // // Extract and print the subkey (schema name)
                // console.log(`  Schema Name: ${schemaKey}`);
                if (schemaKey === "properties") {
                  for (var propKey in schemaValue) {
                    if (Object.hasOwnProperty.call(schemaValue, propKey)) {
                      var propValue = schemaValue[propKey];
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
  };
  GenerateAPICollection.prototype.checkRootNameExist = function (name) {
    if (this.item.length == 0) {
      return false;
    } else {
      return this.item.some(function (element) {
        return element.name === name;
      });
      // item.forEach((group) => {
      //     group.item.forEach((item) => {
      //         // console.log('item=========', item)
      //     })
      // })
      // return false
    }
  };
  GenerateAPICollection.prototype.createNewName = function (name, newItem) {
    this.item.push({
      name: name,
      item: [newItem],
    });
  };
  GenerateAPICollection.prototype.insertInExistingName = function (
    name,
    newItem
  ) {
    var _this = this;
    this.item.map(function (element, index) {
      if (element.name == name) {
        _this.item[index].item.push(newItem);
      }
    });
  };
  GenerateAPICollection.prototype.generateAPICollection = function () {
    for (var endpoint in this.document.paths) {
      if (this.document.paths[endpoint].post) {
        var tempRequestData = {
          name: endpoint,
          request: {
            method: "POST",
            url: {
              raw: "http://localhost:3000/".concat(endpoint),
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
        var value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);
        var postRequestBody = this.document.paths[endpoint].post.requestBody;
        if (
          postRequestBody &&
          postRequestBody.content &&
          postRequestBody.content["application/json"]
        ) {
          var schema = postRequestBody.content["application/json"].schema;
          // console.log('Schema:')
          for (var prop in schema) {
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
        var tempRequestData = {
          name: endpoint,
          request: {
            method: "GET",
            url: {
              raw: "http://localhost:3000/".concat(endpoint),
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)
        // check controller endpoint exist or not
        var value = this.checkRootNameExist(endpoint.split("/")[1]);
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
        var tempRequestData = {
          name: endpoint,
          request: {
            method: "PATCH",
            url: {
              raw: "http://localhost:3000/".concat(endpoint),
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)
        // check controller endpoint exist or not
        var value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);
        var patchRequestBody = this.document.paths[endpoint].patch.requestBody;
        if (
          patchRequestBody &&
          patchRequestBody.content &&
          patchRequestBody.content["application/json"]
        ) {
          var schema = patchRequestBody.content["application/json"].schema;
          for (var prop in schema) {
            tempRequestData.request.url["schemaName"] = schema[prop].includes(
              "/"
            )
              ? schema[prop].split("/").pop()
              : "No '/' characters found";
          }
        }
      }
      if (this.document.paths[endpoint].delete) {
        var tempRequestData = {
          name: endpoint,
          request: {
            method: "DELETE",
            url: {
              raw: "http://localhost:3000/".concat(endpoint),
              protocol: "http",
              host: ["localhost"],
              port: 3000,
              path: endpoint.split("/").slice(1),
            },
          },
        };
        // console.log(`${'\x1b[36m'}: ENDPOINT ${endpoint} ${'\x1b[0m'}`)
        // check controller endpoint exist or not
        var value = this.checkRootNameExist(endpoint.split("/")[1]);
        // console.log(value)
        // if name exist append to existing array
        // else create a new name with array
        value
          ? this.insertInExistingName(endpoint.split("/")[1], tempRequestData)
          : this.createNewName(endpoint.split("/")[1], tempRequestData);
        var deleteRequestBody =
          this.document.paths[endpoint].delete.requestBody;
        if (
          deleteRequestBody &&
          deleteRequestBody.content &&
          deleteRequestBody.content["application/json"]
        ) {
          var schema = deleteRequestBody.content["application/json"].schema;
          for (var prop in schema) {
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
    var filePath = path.join(process.cwd(), "collection.json");
    var collection = {};
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
  };
  return GenerateAPICollection;
})();
exports.default = GenerateAPICollection;
