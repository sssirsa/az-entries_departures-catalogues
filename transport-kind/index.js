const mongodb = require('mongodb');

let entries_departures_client = null;
const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

module.exports = function (context, req) {
    //Create transport kind
    if (req.method === "POST") {
        var transportLineId = req.body['linea_transporte_id'];
        //Transport kind object building
        var newTransportKind = {
            descripcion: req.body.descripcion
        };
            //Search transport line and then add it to transport kind object
            createCosmosClient()
                .then(function () {
                    searchTransportLine(transportLineId)
                        .then(function (transportLine) {
                            if (transportLine) {
                                newTransportKind['linea_transporte'] = transportLine;
                                //Write the transport kind to the database
                                createCosmosClient()
                                    .then(function () {
                                        writeTransportKind(newTransportKind)
                                            .then(function (transportKind) {
                                                context.res = {
                                                    status: 201,
                                                    body: transportKind.ops[0],
                                                    headers:{
                                                        'Content-Type':'application/json'
                                                    }
                                                };
                                                context.done();
                                            })
                                            .catch(function (error) {
                                                context.log('Error writing the transport kind to the database');
                                                context.log(error);
                                                context.res = { status: 500, body: error };
                                                context.done();
                                            });
                                    })
                                    .catch(function (error) {
                                        context.log('Error creating entries_departures_client for transport kind creation ');
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
                                    headers:{
                                        'Content-Type':'application/json'
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

    //Get transport kinds
    if (req.method === "GET") {
        var requestedID;
        var filter;
        if (req.query) {
            requestedID = req.query["id"];
            filter = req.query["filter"];
        }
        if (requestedID) {
            //Search for one transport kind
            createCosmosClient()
                .then(function () {
                    getTransportKind(requestedID)
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
                            context.log('Error reading transport kind from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating entries_departures_client for transport kind detail');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
        else {
            createCosmosClient()
                .then(function () {
                    getTransportKinds(filter)
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
                            context.log('Error reading transport kind from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating entries_departures_client for transport kind list');
                    context.log(error);
                    context.res = { status: 500, body: error };
                    context.done();
                });
        }
    }

    //Delete transport kind
    if (req.method === "DELETE") {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            createCosmosClient()
                .then(function () {
                    deleteTransportKind(requestedID)
                        .then(function () {
                            context.res = {
                                status: 204
                            };
                            context.done();
                        })
                        .catch(function (error) {
                            context.log('Error deleting transport kind from database');
                            context.log(error);
                            context.res = { status: 500, body: error };
                            context.done();
                        });
                })
                .catch(function (error) {
                    context.log('Error creating entries_departures_client for transport kind deletion');
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
                .db(ENTRIES_DEPARTURES_DB_NAME)
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

    function writeTransportKind(transportLine) {
        // Write the entry to the database.
        return new Promise(function (resolve, reject) {
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
                .collection('TransportKind')
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

    function getTransportKind(transportLineId) {
        return new Promise(function (resolve, reject) {
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
                .collection('TransportKind')
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

    function getTransportKinds(query) {
        return new Promise(function (resolve, reject) {
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
                .collection('TransportKind')
                .find(query)
                .toArray(function (error, docs) {
                    if (error) {
                        reject(error);
                    }
                    resolve(docs)
                });
        });
    }

    function deleteTransportKind(transportLineId) {
        return new Promise(function (resolve, reject) {
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
                .collection('TransportKind')
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