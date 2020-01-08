const mongodb = require('mongodb');

//Mongodb connection
let mongo_client = null;
let cosmos_client = null;
const connection_mongoDB = process.env["connection_mongoDB"];
const connection_cosmosDB = process.env["connection_cosmosDB"];

module.exports = function (context, req) {
    //Create transport line
    if (req.method === "POST") {
        var agencyId = req.body['udn_id'];
        var subsidiaryId = req.body['sucursal_id'];
        //Transport line object building
        var newTransportLine = {
            razon_social: req.body.razon_social,
            direccion: req.body.direccion,
            responsable: req.body.responsable
        };
        //TODO: get subsidiary or agency from user when not provided
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
                                                    body: transportLine.ops[0],
                                                    headers:{
                                                        'Content-Type':'application/json'
                                                    }
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
                                        context.log('Error creating cosmos_client for transport line creation ');
                                        context.log(error);
                                        context.res = { status: 500, body: error };
                                        context.done();
                                    });
                            }
                            else {
                                context.log('No subsidiary found with the given id')
                                context.res = {
                                    status: 400,
                                    body: { message: "ES-043" },
                                    headers:{
                                        'Content-Type':'application/json'
                                    }
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
                    context.log('Error creating mongo_client for subsidiary search');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });

        }
        if (agencyId) {
            //TODO: Develop agency search functionality
            //writeTransportLine(JSON.stringify(newTransportLine));
        }
    }

    //Get transport lines
    if (req.method === "GET") {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            //Search for one transport line
            createCosmosClient()
                .then(function () {
                    getTransportLine(requestedID)
                        .then(function (transportLine) {
                            context.res = {
                                status: 200,
                                body: transportLine,
                                headers:{
                                    'Content-Type':'application/json'
                                }
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error reading transport line from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport line detail');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        else {
            createCosmosClient()
                .then(function () {
                    getTransportLines()
                        .then(function (transportLine) {
                            context.res = {
                                status: 200,
                                body: transportLine,
                                headers:{
                                    'Content-Type':'application/json'
                                }
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error reading transport line from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport line list');
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
                    deleteTransportLine(requestedID)
                        .then(function () {
                            context.res = {
                                status: 204,
                                body: {}
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error deleting transport line from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating cosmos_client for transport line deletion');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        else {
            context.res = {
                status: 400,
                body:'The parameter "id" was not found on the request'
            };
            context.done();
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
    }

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

    function getTransportLine(transportLineId) {
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

    function getTransportLines(query) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportLine')
                .find(query)
                .toArray(function (error, docs) {
                    if (error) {
                        reject(error);
                    }
                    resolve(docs)
                });
        });
    }

    function deleteTransportLine(transportLineId) {
        return new Promise(function (resolve, reject) {
            cosmos_client
                .db('EntriesDepartures')
                .collection('TransportLine')
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

};