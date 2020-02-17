const mongodb = require('mongodb');

let entries_departures_client = null;

const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

const STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ONE_MINUTE = 60 * 1000;


module.exports = function (context, req) {
    switch (req.method) {
        case "GET":
            GET_transport_drivers();
            break;
        case "POST":
            POST_transport_drivers();
            break;
        case "DELETE":
            DELETE_transport_driver();
            break;
        default:
            notAllowed();
            break;
    }

    function notAllowed() {
        context.res = {
            status: 405,
            body: "Method not allowed",
            headers: {
                'Content-Type': 'application/json'
            }
        };
        context.done();
    }

    async function GET_transport_drivers() {
        var requestedID;
        var query = {};
        try {
            if (req.query) {
                requestedID = req.query["id"];
                if (req.query["linea_transporte"]) {
                    query['linea_transporte._id'] = mongodb.ObjectId(req.query["linea_transporte"]);
                }
            }
            if (requestedID) {
                let transportDriver = await getTransportDriver(requestedID);
                context.res = {
                    status: 200,
                    body: transportDriver,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            else {
                let transportDrivers = await getTransportDrivers(query);
                context.res = {
                    status: 200,
                    body: transportDrivers,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }

        }
        catch (error) {
            if (error.status) {
                context.res = error;
            }
            else {
                context.res = {
                    status: 500,
                    body: error.toString(),
                    headers: {
                        'Content-Type': 'application / json'
                    }
                }
            }
            context.done();
        }

        async function getTransportDriver(transportDriverId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportDriver')
                    .findOne({ _id: mongodb.ObjectId(transportDriverId) },
                        function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                            if (!docs) {
                                reject({
                                    status: 404,
                                    body: 'No transport kind found with the given ID',
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                            resolve(docs);
                        }
                    );
            });
        }

        async function getTransportDrivers(query) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportDriver')
                    .find(query)
                    .toArray(function (error, docs) {
                        if (error) {
                            reject({
                                status: 500,
                                body: error.toString(),
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            });
                        }
                        resolve(docs)
                    });
            });
        }

    }

    async function POST_transport_drivers() {
        var transportLineId = req.body['linea_transporte_id'];
        var idFront = req.body['identificacion_anverso'];
        var idRear = req.body['identificacion_reverso'];
        //Transport driver object building
        var newTransportDriver = {
            nombre: req.body.nombre,
            identificacion_anverso: null,
            identificacion_reverso: null
        };
        validate();
        try {
            let transportLine;
            if (transportLineId) {
                transportLine = await searchTransportLine(transportLineId);
            }

            //Transport line object building
            var newTransportDriver = {
                nombre: req.body.nombre,
                linea_transporte: transportLine
            };
            let precedentPromises = [transportLine];

            await Promise.all(precedentPromises);
            await writeBlobs();

            let response = await writeTransportDriver(newTransportDriver);

            context.res = {
                status: 201,
                body: response.ops[0],
                headers: {
                    "Content-Type": "application/json"
                }
            }
            context.done();
        }
        catch (error) {
            if (error.status) {
                context.res = error;
            }
            else {
                context.res = {
                    status: 500,
                    body: error.toString(),
                    headers: {
                        'Content-Type': 'application / json'
                    }
                }
            }
            context.done();
        }

        //Internal functions
        function validate() {
            if (!transportLineId) {
                context.res = {
                    status: 400,
                    body: {
                        message: 'ES-062'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
                context.done();
            }
            if (!transportLineId || !newTransportDriver.nombre) {
                context.res = {
                    status: 400,
                    body: 'Required fields: "nombre", "linea_transporte_id"',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
        }

        async function searchTransportLine(transportLineId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportLine')
                    .findOne({ _id: mongodb.ObjectId(transportLineId) },
                        function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                            if (!docs) {
                                reject({
                                    status: 404,
                                    body: 'No transport line found with the given ID',
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                            resolve(docs);
                        }
                    );
            });
        }

        async function writeTransportDriver(transportDriver) {
            await createEntriesDeparturesClient();
            // Write the entry to the database.
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportDriver')
                    .insertOne(transportDriver,
                        function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                            resolve(docs);
                        }
                    );
            });
        }

        async function writeBlobs() {
            //Write files to the storage
            return new Promise(async function (resolve, reject) {
                try {
                    if (idFront) {
                        newTransportDriver['identificacion_anverso'] = await writeBlob(idFront);
                    }
                    if (idRear) {
                        newTransportDriver['identificacion_reverso'] = await writeBlob(idRear);
                    }
                    resolve();
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }

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
                throw new Error(e);
            }
        }        

    }

    async function DELETE_transport_driver() {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            try {
                await deleteTransportDriver(requestedID);
                context.res = {
                    status: 204
                };
                context.done();
            }
            catch (error) {
                if (error.status) {
                    context.res = error;
                }
                else {
                    context.res = {
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    }
                }
                context.done();
            }
        }
        else {
            context.res = {
                status: 400,
                body: 'The parameter "id" was not found on the request'
            };
            context.done();
        }

        async function deleteTransportDriver(transportDriverId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportDriver')
                    .deleteOne({ _id: mongodb.ObjectId(transportDriverId) },
                        function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        'Content-Type': 'application / json'
                                    }
                                });
                            }
                            resolve(docs);
                        }
                    );
            });
        }
    }

    //Internal global functions

    function createEntriesDeparturesClient() {
        return new Promise(function (resolve, reject) {
            if (!entries_departures_client) {
                mongodb.MongoClient.connect(connection_EntriesDepartures,
                    function (error, _management_client) {
                        if (error) {
                            reject({
                                status: 500,
                                body: error.toString(),
                                headers: {
                                    'Content-Type': 'application / json'
                                }
                            });
                        }
                        entries_departures_client = _management_client;
                        resolve();
                    });
            }
            else {
                resolve();
            }
        });
    }
};


// module.exports = function (context, req) {

//     switch (req.method) {
//         case "POST":
//             POST_transport_driver();
//             break;
//         case "GET":
//             GET_transport_driver();
//             break;
//         case "DELETE":
//             DELETE_transport_driver();
//             break;
//         default:
//             notAllowed();
//             break;
//     }

//     function notAllowed() {
//         context.res = {
//             status: 405,
//             body: "Method not allowed",
//             headers: {
//                 'Content-Type': 'application/json'
//             }
//         };
//         context.done();
//     }

//     //Create transport driver
//     async function POST_transport_driver() {
//         var transportLineId = req.body['linea_transporte_id'];
//         var idFront = req.body['identificacion_anverso'];
//         var idRear = req.body['identificacion_reverso'];
//         //Transport driver object building
//         var newTransportDriver = {
//             nombre: req.body.nombre,
//             identificacion_anverso: null,
//             identificacion_reverso: null
//         };
//         try {
//             //Rejecting the request if the minimum fields are not received
//             if (!transportLineId || !idFront || !newTransportDriver.nombre) {
//                 context.res = {
//                     status: 400,
//                     body: 'Required fields: "nombre", "linea_transporte_id", "identificacion_anverso" ',
//                     headers: {
//                         'Content-Type': 'application/json'
//                     }
//                 };
//                 context.done();
//             }
//             //Write files to the storage
//             newTransportDriver['identificacion_anverso'] = await writeBlob(idFront);
//             if (idRear) {
//                 newTransportDriver['identificacion_reverso'] = await writeBlob(idRear);
//             }
//             //Search transport line and then add it to transport driver object
//             createEntriesDeparturesClient()
//                 .then(function () {
//                     searchTransportLine(transportLineId)
//                         .then(function (transportLine) {
//                             if (transportLine) {
//                                 newTransportDriver['linea_transporte'] = transportLine;
//                                 //Write the transport driver to the database
//                                 createEntriesDeparturesClient()
//                                     .then(function () {
//                                         writeTransportDriver(newTransportDriver)
//                                             .then(function (transportDriver) {
//                                                 context.res = {
//                                                     status: 201,
//                                                     body: transportDriver.ops[0],
//                                                     headers: {
//                                                         'Content-Type': 'application/json'
//                                                     }
//                                                 };
//                                                 context.done();
//                                             })
//                                             .catch(function (error) {
//                                                 context.log('Error writing the transport driver to the database');
//                                                 context.log(error);
//                                                 context.res = { status: 500, body: error };
//                                                 context.done();
//                                             });
//                                     })
//                                     .catch(function (error) {
//                                         context.log('Error creating entries_departures_client for transport driver creation');
//                                         context.log(error);
//                                         context.res = { status: 500, body: error };
//                                         context.done();
//                                     });
//                             }
//                             else {
//                                 context.log('No transport line found with the given id')
//                                 context.res = {
//                                     status: 400,
//                                     body: { message: "ES-044" },
//                                     headers: {
//                                         'Content-Type': 'application/json'
//                                     }
//                                 };
//                                 context.done();
//                             }
//                         })
//                         .catch(function (error) {
//                             context.log('Error searching transport line');
//                             context.log(error);
//                             context.res = { status: 500, body: error };
//                             context.done();
//                         });
//                 })
//                 .catch(function (error) {
//                     context.log('Error creating entries_departures_client for transport line search');
//                     context.log(error);
//                     context.res = { status: 500, body: error };
//                     context.done();
//                 });
//         }
//         catch (error) {
//             if (error.status) {
//                 context.res = error;
//             }
//             else {
//                 context.res = {
//                     status: 500,
//                     body: error.toString(),
//                     headers: {
//                         'Content-Type': 'application / json'
//                     }
//                 }
//             }
//             context.done();
//         }

//         //Internal functions
//         async function writeTransportDriver(transportLine) {
//             await createEntriesDeparturesClient();
//             // Write the entry to the database.
//             return new Promise(function (resolve, reject) {
//                 entries_departures_client
//                     .db(ENTRIES_DEPARTURES_DB_NAME)
//                     .collection('TransportDriver')
//                     .insertOne(transportLine,
//                         function (error, docs) {
//                             if (error) {
//                                 reject(error);
//                             }
//                             resolve(docs);
//                         }
//                     );
//             });
//         }
//     }

//     //Get transport drivers
//     async function GET_transport_driver() {
//         var requestedID;
//         var filter;
//         if (req.query) {
//             requestedID = req.query["id"];
//             filter = req.query["filter"];
//         }
//         if (requestedID) {
//             //Search for one transport driver
//             let transportDriver = await getTransportDriver(requestedID);
//             context.res = {
//                 status: 201,
//                 body: transportDriver,
//                 headers: {
//                     'Content-Type': 'application/json'
//                 }
//             };
//             context.done();
//             // .then(function (transportDriver) {
//             //     context.res = {
//             //         status: 200,
//             //         body: transportDriver,
//             //         headers: {
//             //             'Content-Type': 'application/json'
//             //         }
//             //     };
//             //     context.done();
//             // })
//             // .catch(function (error) {
//             //     context.log('Error reading transport driver from database');
//             //     context.log(error);
//             //     context.res = { status: 500, body: error };
//             //     context.done();
//             // });

//         }
//         else {
//             createEntriesDeparturesClient()
//                 .then(function () {
//                     getTransportDrivers(filter)
//                         .then(function (transportDrivers) {
//                             context.res = {
//                                 status: 200,
//                                 body: transportDrivers,
//                                 headers: {
//                                     'Content-Type': 'application/json'
//                                 }
//                             };
//                             context.done();
//                         })
//                         .catch(function (error) {
//                             context.log('Error reading transport drivers from database');
//                             context.log(error);
//                             context.res = { status: 500, body: error };
//                             context.done();
//                         });
//                 })
//                 .catch(function (error) {
//                     context.log('Error creating entries_departures_client for transport drivers list');
//                     context.log(error);
//                     context.res = { status: 500, body: error };
//                     context.done();
//                 });
//         }

//         //Internal functions

//         async function getTransportDriver(transportDriverId) {
//             await createEntriesDeparturesClient();
//             return new Promise(function (resolve, reject) {
//                 entries_departures_client
//                     .db(ENTRIES_DEPARTURES_DB_NAME)
//                     .collection('TransportDriver')
//                     .findOne({ _id: mongodb.ObjectId(transportDriverId) },
//                         function (error, docs) {
//                             if (error) {
//                                 reject({
//                                     status: 500,
//                                     body: error.toString(),
//                                     headers: {
//                                         "Content-Type": "application/json"
//                                     }
//                                 });
//                             }
//                             if (!docs) {
//                                 reject({
//                                     status: 404,
//                                     body: 'No transport driver found with the given ID',
//                                     headers: {
//                                         "Content-Type": "application/json"
//                                     }
//                                 });
//                             }
//                             resolve(docs);
//                         }
//                     );
//             });
//         }

//         async function getTransportDrivers(query) {
//             await createEntriesDeparturesClient();
//             return new Promise(function (resolve, reject) {
//                 entries_departures_client
//                     .db(ENTRIES_DEPARTURES_DB_NAME)
//                     .collection('TransportDriver')
//                     .find(query)
//                     .toArray(function (error, docs) {
//                         if (error) {
//                             reject({
//                                 status: 500,
//                                 body: error.toString(),
//                                 headers: {
//                                     "Content-Type": "application/json"
//                                 }
//                             });
//                         }
//                         resolve(docs)
//                     });
//             });
//         }
//     }

//     //Delete transport driver
//     function DELETE_transport_driver() {
//         var requestedID;
//         if (req.query) {
//             requestedID = req.query["id"];
//         }
//         if (requestedID) {
//             //Search for one transport line
//             createEntriesDeparturesClient()
//                 .then(function () {
//                     deleteTransportDriver(requestedID)
//                         .then(function () {
//                             context.res = {
//                                 status: 204
//                             };
//                             context.done();
//                         })
//                         .catch(function (error) {
//                             context.log('Error deleting transport driver from database');
//                             context.log(error);
//                             context.res = { status: 500, body: error };
//                             context.done();
//                         });
//                 })
//                 .catch(function (error) {
//                     context.log('Error creating entries_departures_client for transport driver deletion');
//                     context.log(error);
//                     context.res = { status: 500, body: error };
//                     context.done();
//                 });
//         }
//         else {
//             context.res = {
//                 status: 400,
//                 body: 'The parameter "id" was not found on the request'
//             };
//             context.done();
//         }

//         //Internal functions
//         function deleteTransportDriver(transportLineId) {
//             return new Promise(function (resolve, reject) {
//                 entries_departures_client
//                     .db(ENTRIES_DEPARTURES_DB_NAME)
//                     .collection('TransportDriver')
//                     .deleteOne({ _id: mongodb.ObjectId(transportLineId) },
//                         function (error, docs) {
//                             if (error) {
//                                 reject(error);
//                             }
//                             resolve(docs);
//                         }
//                     );
//             });
//         }
//     }


//     function searchTransportLine(transportLineId) {
//         return new Promise(function (resolve, reject) {
//             entries_departures_client
//                 .db(ENTRIES_DEPARTURES_DB_NAME)
//                 .collection('TransportLine')
//                 .findOne({ _id: mongodb.ObjectId(transportLineId) },
//                     function (error, docs) {
//                         if (error) {
//                             reject(error);
//                         }
//                         resolve(docs);
//                     }
//                 );
//         });
//     }

//     async function writeBlob(base64String) {
//         //Local imports
//         const {
//             BlobServiceClient
//         } = require('@azure/storage-blob');
//         global.atob = require('atob');
//         global.Blob = require('node-blob');
//         const b64toBlob = require('b64-to-blob');
//         const { AbortController } = require('@azure/abort-controller');
//         const containerName = 'driver-id';

//         var base64Data = base64String.split(';base64,').pop();
//         var contentType = base64String.split(';base64,').shift().replace('data:', '');
//         var fileFormat = contentType.split('/').pop();
//         var blobName = containerName + new mongodb.ObjectID() + '.' + fileFormat;
//         var storageUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;

//         try {
//             var blobImage = b64toBlob(base64Data, contentType);

//             var blobServiceClient = await BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
//             var containerClient = await blobServiceClient.getContainerClient(containerName);

//             var blobClient = await containerClient.getBlobClient(blobName);
//             var blockBlobClient = await blobClient.getBlockBlobClient();
//             var aborter = AbortController.timeout(10 * ONE_MINUTE);
//             await blockBlobClient.upload(blobImage.buffer, blobImage.size, aborter);
//             return storageUrl + '/' + containerName + '/' + blobName;
//         }
//         catch (e) {
//             throw new Error(e);
//         }
//     }

//     //Internal global functions

//     function createEntriesDeparturesClient() {
//         return new Promise(function (resolve, reject) {
//             if (!entries_departures_client) {
//                 mongodb.MongoClient.connect(connection_EntriesDepartures, function (error, _entries_departures_client) {
//                     if (error) {
//                         reject(error);
//                     }
//                     entries_departures_client = _entries_departures_client;
//                     resolve();
//                 });
//             }
//             else {
//                 resolve();
//             }
//         });
//     }

// };