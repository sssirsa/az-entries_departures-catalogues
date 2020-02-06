const mongodb = require('mongodb');

let entries_departures_client = null;

const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;


const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ONE_MINUTE = 60 * 1000;

module.exports = function (context, req) {

    switch (req.method) {
        case "POST":
            post_TransportDriver();
            break;
        case "GET":
            get_TransportDriver();
            break;
    }

    //Create transport driver
    async function post_TransportDriver() {
        var transportLineId = req.body['linea_transporte_id'];
        var idFront = req.body['identificacion_anverso'];
        var idRear = req.body['identificacion_reverso'];
        //Transport driver object building
        var newTransportDriver = {
            nombre: req.body.nombre,
            identificacion_anverso: null,
            identificacion_reverso: null
        };
        try {
            //Rejecting the request if the minimum fields are not received
            if (!transportLineId || !idFront || !newTransportDriver.nombre) {
                context.res = {
                    status: 400,
                    body: 'Required fields: "nombre", "linea_transporte_id", "identificacion_anverso" ',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            //Write files to the storage
            newTransportDriver['identificacion_anverso'] = await writeBlob(idFront);
            if (idRear) {
                newTransportDriver['identificacion_reverso'] = await writeBlob(idRear);
            }
            //Search transport line and then add it to transport driver object
            createCosmosClient()
                .then(function () {
                    searchTransportLine(transportLineId)
                        .then(function (transportLine) {
                            if (transportLine) {
                                newTransportDriver['linea_transporte'] = transportLine;
                                //Write the transport driver to the database
                                createCosmosClient()
                                    .then(function () {
                                        writeTransportDriver(newTransportDriver)
                                            .then(function (transportDriver) {
                                                context.res = {
                                                    status: 201,
                                                    body: transportDriver.ops[0],
                                                    headers: {
                                                        'Content-Type': 'application/json'
                                                    }
                                                };
                                                context.done();
                                            })
                                            .catch(function (error) {
                                                context.log('Error writing the transport driver to the database');
                                                context.log(error);
                                                context.res = { status: 500, body: error };
                                                context.done();
                                            });
                                    })
                                    .catch(function (error) {
                                        context.log('Error creating entries_departures_client for transport driver creation');
                                        context.log(error);
                                        context.res = { status: 500, body: error };
                                        context.done();
                                    });
                            }
                            else {
                                context.log('No transport line found with the given id')
                                context.res = {
                                    status: 400,
                                    body: { message: "ES-044" },
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                };
                                context.done();
                            }
                        })
                        .catch(function (error) {
                            context.log('Error searching transport line');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating entries_departures_client for transport line search');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        catch (error) {
            context.log('Error while writting the driver-id files to the storage');
            context.res = {
                status: 500,
                body: error,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            context.done();
        }
    }

    //Get transport drivers
    async function get_TransportDriver() {
        var requestedID;
        var filter;
        if (req.query) {
            requestedID = req.query["id"];
            filter = req.query["filter"];
        }
        if (requestedID) {
            //Search for one transport driver
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
                    context.log('Error creating entries_departures_client for transport driver detail');
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
                    context.log('Error creating entries_departures_client for transport drivers list');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
    }

    //Delete transport driver
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
                    context.log('Error creating entries_departures_client for transport driver deletion');
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
            if (!entries_departures_client) {
                mongodb.MongoClient.connect(connection_EntriesDepartures, function (error, _entries_departures_client) {
                    if (error) {
                        reject(error);
                    }
                    entries_departures_client = _entries_departures_client;
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
            entries_departures_client
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
            entries_departures_client
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
            entries_departures_client
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
            entries_departures_client
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
            entries_departures_client
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

    async function writeBlob(base64String) {
        //Local imports
        const {
            BlobServiceClient
        } = require('@azure/storage-blob');
        global.atob = require('atob');
        global.Blob = require('node-blob');
        const b64toBlob = require('b64-to-blob');
        const { AbortController } = require('@azure/abort-controller');
        const containerName = 'driver-id';

        var base64Data = base64String.split(';base64,').pop();
        var contentType = base64String.split(';base64,').shift().replace('data:', '');
        var fileFormat = contentType.split('/').pop();
        var blobName = containerName + new mongodb.ObjectID() + '.' + fileFormat;
        var storageUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;

        try {
            var blobImage = b64toBlob(base64Data, contentType);

            var blobServiceClient = await BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
            var containerClient = await blobServiceClient.getContainerClient(containerName);

            var blobClient = await containerClient.getBlobClient(blobName);
            var blockBlobClient = await blobClient.getBlockBlobClient();
            var aborter = AbortController.timeout(10 * ONE_MINUTE);
            await blockBlobClient.upload(blobImage.buffer, blobImage.size, aborter);
            return storageUrl + '/' + containerName + '/' + blobName;
        }
        catch (e) {
            throw new Error(500);
        }
    }

};