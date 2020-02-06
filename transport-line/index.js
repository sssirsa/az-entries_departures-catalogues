const mongodb = require('mongodb');

//Mongodb connection
let management_client = null;
let entries_departures_client = null;
const connection_Management = process.env["connection_Management"];
const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const MANAGEMENT_DB_NAME = process.env['MANAGEMENT_DB_NAME'];
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

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
                                        context.log('Error creating entries_departures_client for transport line creation ');
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
                    context.log('Error creating management_client for subsidiary search');
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
                    context.log('Error creating entries_departures_client for transport line detail');
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
                    context.log('Error creating entries_departures_client for transport line list');
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
                                status: 204
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
                    context.log('Error creating entries_departures_client for transport line deletion');
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
            if (!management_client) {
                mongodb.MongoClient.connect(connection_Management, function (error, _management_client) {
                    if (error) {
                        reject(error);
                    }
                    management_client = _management_client;
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

    function searchSubsidiary(subsidiaryId) {
        return new Promise(function (resolve, reject) {
            management_client
                .db(MANAGEMENT_DB_NAME)
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
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
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

    function getTransportLines(query) {
        return new Promise(function (resolve, reject) {
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
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
            entries_departures_client
                .db(ENTRIES_DEPARTURES_DB_NAME)
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