const mongodb = require('mongodb');

let cosmos_client = null;

const connection_cosmosDB = process.env["connection_cosmosDB"];
const connection_storage = process.env["storageentriesdepartures_STORAGE"];

const {

    StorageSharedKeyCredential,

    BlobServiceClient

} = require('@azure/storage-blob');

module.exports = function (context, req) {
    //Create transport kind
    if (req.method === "POST") {
        var transportLineId = req.body['linea_transporte_id'];
        var idFront = req.body['identificacion_anverso'];
        var idRear = req.body['identificacion_reverso'];
        //Transport driver object building
        var newTransportDriver = {
            nombre: req.body.nombre,
            identificacion_anverso: null,
            identificacion_reverso: null
        };
        writeBlob(idFront);
        //Rejecting the request if the minimum fields are not received
        // if (!transportLineId || !idFront || !newTransportDriver.nombre) {
        //     context.res = {
        //         status: 400,
        //         body: 'Required fields: "nombre", "linea_transporte_id", "identificacion_anverso" ',
        //         headers: {
        //             'Content-Type': 'application/json'
        //         }
        //     };
        //     context.done();
        // }
        // //Search transport line and then add it to transport line object
        // createCosmosClient()
        //     .then(function () {
        //         searchTransportLine(transportLineId)
        //             .then(function (transportLine) {
        //                 if (transportLine) {
        //                     newTransportDriver['linea_transporte'] = transportLine;
        //                     //Write the transport line to the database
        //                     createCosmosClient()
        //                         .then(function () {
        //                             writeTransportDriver(newTransportDriver)
        //                                 .then(function (transportDriver) {
        //                                     context.res = {
        //                                         status: 201,
        //                                         body: transportDriver.ops[0],
        //                                         headers: {
        //                                             'Content-Type': 'application/json'
        //                                         }
        //                                     };
        //                                     context.done();
        //                                 })
        //                                 .catch(function (error) {
        //                                     context.log('Error writing the transport driver to the database');
        //                                     context.log(error);
        //                                     context.res = { status: 500, body: error };
        //                                     context.done();
        //                                 });
        //                         })
        //                         .catch(function (error) {
        //                             context.log('Error creating cosmos_client for transport driver creation');
        //                             context.log(error);
        //                             context.res = { status: 500, body: error };
        //                             context.done();
        //                         });
        //                 }
        //                 else {
        //                     context.log('No transport line found with the given id')
        //                     context.res = {
        //                         status: 400,
        //                         body: { message: "ES-044" },
        //                         headers: {
        //                             'Content-Type': 'application/json'
        //                         }
        //                     };
        //                     context.done();
        //                 }
        //             })
        //             .catch(function (error) {
        //                 context.log('Error searching transport line');
        //                 context.log(error);
        //                 context.res = { status: 500, body: error };
        //                 context.done();
        //             });
        //     })
        //     .catch(function (error) {
        //         context.log('Error creating cosmos_client for transport line search');
        //         context.log(error);
        //         context.res = { status: 500, body: error };
        //         context.done();
        //     });
    }

    //Get transport lines
    if (req.method === "GET") {
        var requestedID;
        var filter;
        if (req.query) {
            requestedID = req.query["id"];
            filter = req.query["filter"];
        }
        if (requestedID) {
            //Search for one transport line
            createCosmosClient()
                .then(function () {
                    getTransportDriver(requestedID)
                        .then(function (transportDriver) {
                            context.res = {
                                status: 200,
                                body: transportDriver,
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error reading transport driver from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport driver detail');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        else {
            createCosmosClient()
                .then(function () {
                    getTransportDrivers(filter)
                        .then(function (transportDrivers) {
                            context.res = {
                                status: 200,
                                body: transportDrivers,
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error reading transport drivers from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport drivers list');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
    }

    //Delete transport line
    if (req.method === "DELETE") {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            //Search for one transport line
            createCosmosClient()
                .then(function () {
                    deleteTransportDriver(requestedID)
                        .then(function () {
                            context.res = {
                                status: 204
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error deleting transport driver from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport driver deletion');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        else {
            context.res = {
                status: 400,
                body: 'The parameter "id" was not found on the request'
            };
            context.done();
        }
    }

    function createCosmosClient() {
        return new Promise(function (resolve, reject) {
            if (!cosmos_client) {
                mongodb.MongoClient.connect(connection_cosmosDB, function (error, _cosmos_client) {
                    if (error) {
                        reject(error);
                    }
                    cosmos_client = _cosmos_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

    function searchTransportLine(transportLineId) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportLine')
                .findOne({ _id: mongodb.ObjectId(transportLineId) },
                    function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        resolve(docs);
                    }
                );
        });
    }

    function writeTransportDriver(transportLine) {
        // Write the entry to the database.
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportDriver')
                .insertOne(transportLine,
                    function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        resolve(docs);
                    }
                );
        });
    }

    function getTransportDriver(transportLineId) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportDriver')
                .findOne({ _id: mongodb.ObjectId(transportLineId) },
                    function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        resolve(docs);
                    }
                );
        });
    }

    function getTransportDrivers(query) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportDriver')
                .find(query)
                .toArray(function (error, docs) {
                    if (error) {
                        reject(error);
                    }
                    resolve(docs)
                });
        });
    }

    function deleteTransportDriver(transportLineId) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportDriver')
                .deleteOne({ _id: mongodb.ObjectId(transportLineId) },
                    function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        resolve(docs);
                    }
                );
        });
    }

    async function writeBlob(base64Image) {
        //TODO:Create blob file from base64 string
        //TODO: Get the file format and size from the blob file
        fileFormat = 'png';
        fileSize=base64Image.length;
        const blobServiceClient = await BlobServiceClient.fromConnectionString(connection_storage);
        context.log('Obtained blob service client');
        const containerClient = await blobServiceClient.getContainerClient('driver-id');
        const blobName = 'driver-id' + new mongodb.ObjectID() + '.' + fileFormat;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const uploadBlobResponse = await blockBlobClient.upload(base64Image, base64Image.length);
        context.log('Blob successfully created');
        context.log(uploadBlobResponse);
        context.done();
    }

};