const mongodb = require('mongodb');

//Mongodb connection
let mongo_client = null;
let cosmos_client = null;
const connection_mongoDB = "mongodb+srv://lalo:7EXlGBwqcI4u71ZQ@prueba-nztlg.mongodb.net/sssirsa?retryWrites=true&w=majority";
connection_cosmosDB= "mongodb://sssirsa-entriesdepartures-db-de:K8LIx862ukaHRhDjRtxEV3CK5ixBKn916sBC4vlclhgsVFDunmXDemrSaiVOUx0oGoOrxrCUBh6wi2SOToRtHg%3D%3D@sssirsa-entriesdepartures-db-de.documents.azure.com:10255/?ssl=true";

module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    //Create transport line
    if (req.method === "POST") {
        var transportLine = context.bindings.transportLine;
        if (transportLine) {
            context.res = {
                status: 422,
                body: "Transport line already exists.",
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
        else {
            var agencyId = req.body['udn_id'];
            var subsidiaryId = req.body['sucursal_id'];
            var newTransportLine = {
                id: new mongodb.ObjectID(),
                razon_social: req.body.razon_social,
                direccion: req.body.direccion,
                responsable: req.body.responsable
            };
            if (subsidiaryId) {
                //Search subsidiary and then add it to transport line object
                createMongoClient()
                    .then(function () {
                        searchSubsidiary(subsidiaryId)
                            .then(function (subsidiary) {
                                if (subsidiary) {
                                    newTransportLine['sucursal'] = subsidiary;
                                    //Write the transport line to the database
                                    createCosmosClient()
                                        .then(function () {
                                            writeTransportLine(newTransportLine)
                                                .then(function (transportLine) {
                                                    context.res = {
                                                        status: 201,
                                                        body: transportLine.ops[0]
                                                    };
                                                    context.done();
                                                })
                                                .catch(function (error) {
                                                    context.log('Error writing the transport line to the database');
                                                    context.log(error);
                                                    context.res = { status: 500, body: error };
                                                    context.done();
                                                });
                                        })
                                        .catch(function (error) {
                                            context.log('Error creating mongoclient for transport line creation ');
                                            context.log(error);
                                            context.res = { status: 500, body: error };
                                            context.done();
                                        });
                                }
                                else {
                                    context.log('No subsidiary found with the given id')
                                    context.res = {
                                        status: 400,
                                        body: { message: "ES-043" }
                                    };
                                    context.done();
                                }
                            })
                            .catch(function (error) {
                                context.log('Error searching subsidiary');
                                context.log(error);
                                context.res = { status: 500, body: error };
                                context.done();
                            });
                    })
                    .catch(function (error) {
                        context.log('Error creating mongoclient for subsidiary search');
                        context.log(error);
                        context.res = { status: 500, body: error };
                        context.done();
                    });

            }
            if (agencyId) {
                //TODO: Develop agency search functionality
                //writeTransportLine(JSON.stringify(newTransportLine));
            }
            // else {
            //     //TODO: get subsidiary or agency from user when not provided
            //     return writeTransportLine(JSON.stringify(newTransportLine));
            // }

        }
    }

    //Get entries
    if (req.method === "GET") {
        //TODO: Add filter for returning just the NEW FRIDGES entries
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            var entry = context.bindings.entry;
            context.res = {
                status: 200,
                body: entry,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
        else {
            var entries = context.bindings.entries;
            context.res = {
                status: 200,
                body: entries,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }

    function createMongoClient() {
        return new Promise(function (resolve, reject) {
            if (!mongo_client) {
                mongodb.MongoClient.connect(connection_mongoDB, function (error, _mongo_client) {
                    if (error) {
                        reject(error);
                    }
                    mongo_client = _mongo_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
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

    function searchSubsidiary(subsidiaryId) {
        return new Promise(function (resolve, reject) {
            mongo_client
                .db('sssirsa')
                .collection('subsidiaries')
                .findOne({ _id: mongodb.ObjectId(subsidiaryId) },
                    function (error, docs) {
                        if (error) {
                            reject(error);
                        }
                        resolve(docs);
                    }
                );
        });
    };

    function writeTransportLine(transportLine) {
        // Write the entry to the database.
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportLine')
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

};