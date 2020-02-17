const mongodb = require('mongodb');

let entries_departures_client = null;
const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

module.exports = function (context, req) {
    switch (req.method) {
        case "GET":
            GET_transport_kinds();
            break;
        case "POST":
            POST_transport_kinds();
            break;
        case "DELETE":
            DELETE_transport_kind();
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

    async function GET_transport_kinds() {
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
                    let transportKind = await getTransportKind(requestedID);
                    context.res = {
                        status: 200,
                        body: transportKind,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    };
                    context.done();
                }
                else {
                    let transportKinds = await getTransportKinds(query);
                    context.res = {
                        status: 200,
                        body: transportKinds,
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

        async function getTransportKind(transportKindId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportKind')
                    .findOne({ _id: mongodb.ObjectId(transportKindId) },
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

        async function getTransportKinds(query) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportKind')
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

    async function POST_transport_kinds() {

        var transportLineId = req.body['linea_transporte'];
        validate();
        try {
            let transportLine;
            if (transportLineId) {
                transportLine = await searchTransportLine(transportLineId);
            }

            //Transport line object building
            var newTransportKind = {
                descripcion: req.body.descripcion,
                linea_transporte:transportLine
            };
            let precedentPromises = [transportLine];

            await Promise.all(precedentPromises);

            let response = await writeTransportKind(newTransportKind);

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
                //at least one
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

        async function writeTransportKind(transportKind) {
            await createEntriesDeparturesClient();
            // Write the entry to the database.
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportKind')
                    .insertOne(transportKind,
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
    }

    async function DELETE_transport_kind() {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            try {
                await deleteTransportKind(requestedID);
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

        async function deleteTransportKind(transportKindId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportKind')
                    .deleteOne({ _id: mongodb.ObjectId(transportKindId) },
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
