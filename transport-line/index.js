const mongodb = require('mongodb');

// URI for MongoDB Atlas
const uri = 'mongodb+srv://lalo:7EXlGBwqcI4u71ZQ@prueba-nztlg.mongodb.net/sssirsa?retryWrites=true&w=majority';

//Mongodb connection
let client = null;

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
                //Search subsidiary and then add it to transport line
                searchSubsidiary(subsidiaryId)
                    .then(function (subsidiary) {
                        newTransportLine['sucursal'] = subsidiary;
                        return writeTransportLine(JSON.stringify(newTransportLine));
                    })
                    .catch(function (error) {
                        context.res = error;
                        return context.done();
                    });
            }
            if (agencyId) {
                //TODO: Develop agency search functionality
                return writeTransportLine(JSON.stringify(newTransportLine));
            }
            else {
                //TODO: get subsidiary or agency from user when not provided
                return writeTransportLine(JSON.stringify(newTransportLine));
            }

        }
        //context.done();
    }

    function writeTransportLine(transportLineString) {
        // Write the entry to the database.
        context.bindings.newTransportLine = transportLineString;

        // Push this bookmark onto our queue for further processing.
        //context.bindings.newmessage = bookmarkString;

        // Tell the user all is well.
        context.res = {
            status: 201,
            body: transportLineString,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        context.done();
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
        context.done();
    }

    function searchSubsidiary (subsidiaryId) {
        return new Promise(function (resolve, reject) {
            if (!client) {
                mongodb.MongoClient.connect(uri, function (error, _client) {
                    if (error) {
                        reject({ status: 500, body: res.stack });
                        // context.log('Failed to connect');
                        // context.res = { status: 500, body: res.stack }
                        // return context.done();
                    }
                    client = _client;
                    querySubsidiary(subsidiaryId)
                        .then(function (subsidiary) {
                            resolve(subsidiary);
                        })
                        .catch(function (error) {
                            reject(error);
                        });
                });
            }


        });
    };

    function querySubsidiary (subsidiaryId) {
        return new Promise(function (resolve, reject) {
            client
                .db('sssirsa')
                .collection('subsidiaries')
                .findOne({ _id: mongodb.ObjectId(subsidiaryId) },
                    function (error, docs) {
                        if (error) {
                            reject({ status: 500, body: res.stack });
                            // context.log('Error running query');
                            // context.res = { status: 500, body: res.stack }
                            // return context.done();
                        }
                        // context.res = {
                        //     headers: { 'Content-Type': 'application/json' },
                        //     body: JSON.stringify({ res: docs.res })
                        // };
                        // context.done();
                        resolve(docs.res);
                    }
                );
        });
    };


};