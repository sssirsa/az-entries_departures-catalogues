const mongodb = require('mongodb');

//Mongodb connection
let management_client = null;
let entries_departures_client = null;
const connection_Management = process.env["connection_Management"];
const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const MANAGEMENT_DB_NAME = process.env['MANAGEMENT_DB_NAME'];
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

module.exports = function (context, req) {
    switch (req.method) {
        case "GET":
            GET_transport_lines();
            break;
        case "POST":
            POST_transport_line();
            break;
        case "DELETE":
            DELETE_transport_line();
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

    async function GET_transport_lines() {
        var requestedID;
        var query = {};
        try {
            if (req.query) {
                requestedID = req.query["id"];
                if (req.query["sucursal"]) {
                    query['sucursal._id'] = mongodb.ObjectId(req.query["sucursal"]);
                }
                if (req.query["udn"]) {
                    query['udn._id'] = mongodb.ObjectId(req.query["udn"]);
                }
            }
            if (requestedID) {
                let transportLine = await getTransportLine(requestedID);
                context.res = {
                    status: 200,
                    body: transportLine,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            else {
                let transportLines = await getTransportLines(query);
                context.res = {
                    status: 200,
                    body: transportLines,
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

        async function getTransportLine(transportLineId) {
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

        async function getTransportLines(query) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportLine')
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

    async function POST_transport_line() {

        var agencyIdArray = req.body['udn'];
        var subsidiaryIdArray = req.body['sucursal'];
        validate();
        try {
            let agencyArray, subsidiaryArray;
            if (agencyIdArray) {
                if (agencyIdArray.length) {
                    agencyIdArray = await searchAllAgencies(agencyIdArray);
                }
            }
            if (subsidiaryIdArray) {
                if (subsidiaryIdArray.length) {
                    subsidiaryArray = await searchAllSubsidiaries(subsidiaryIdArray);
                }
            }

            //Transport line object building
            var newTransportLine = {
                razon_social: req.body.razon_social,
                direccion: req.body.direccion,
                responsable: req.body.responsable,
                sucursal: subsidiaryArray,
                udn: agencyArray
            };
            let precedentPromises = [agencyArray, subsidiaryArray];

            await Promise.all(precedentPromises);

            let response = await writeTransportLine(newTransportLine);

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
            if (!agencyIdArray && !subsidiaryIdArray) {
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
            if (agencyIdArray && subsidiaryIdArray) {
                //not both
                context.res = {
                    status: 400,
                    body: {
                        message: 'ES-063'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
                context.done();
            }
            if (subsidiaryIdArray) {
                if (!subsidiaryIdArray.length) {
                    //Zero length subsidiary array
                    context.res = {
                        status: 400,
                        body: {
                            message: 'ES-064'
                        },
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                    context.done();
                }
            }
            if (agencyIdArray) {
                if (!agencyIdArray.length) {
                    //Zero length agency array 
                    context.res = {
                        status: 400,
                        body: {
                            message: 'ES-065'
                        },
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                    context.done();
                }
            }
        }

        function searchAllSubsidiaries(subsidiariesIdArray) {
            return new Promise(async function (resolve, reject) {
                var subsidiariesInfoPromises = [];
                while (subsidiariesIdArray.length) {
                    subsidiariesInfoPromises.push(
                        searchSubsidiary(
                            subsidiariesIdArray.pop()
                        )
                    );
                }
                try {
                    let subsidiariesArray = await Promise.all(subsidiariesInfoPromises);
                    resolve(subsidiariesArray);
                }
                catch (error) {
                    var res;
                    if (error.status) {
                        res = error;
                    }
                    else {
                        res = {
                            status: 500,
                            body: error.toString(),
                            headers: {
                                'Content-Type': 'application / json'
                            }
                        }
                    }
                    reject(res);
                }
            });
        }

        async function searchSubsidiary(subsidiaryId) {
            await createManagementClient();
            return new Promise(function (resolve, reject) {
                management_client
                    .db(MANAGEMENT_DB_NAME)
                    .collection('subsidiaries')
                    .findOne({ _id: mongodb.ObjectId(subsidiaryId) },
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

        function searchAllAgencies(agenciesIdArray) {
            return new Promise(async function (resolve, reject) {
                var agenciesInfoPromises = [];
                while (agenciesIdArray.length) {
                    agenciesInfoPromises.push(
                        searchAgency(
                            agenciesIdArray.pop()
                        )
                    );
                }
                try {
                    let agenciesArray = await Promise.all(agenciesInfoPromises);
                    resolve(agenciesArray);
                }
                catch (error) {
                    var res;
                    if (error.status) {
                        res = error;
                    }
                    else {
                        res = {
                            status: 500,
                            body: error.toString(),
                            headers: {
                                'Content-Type': 'application / json'
                            }
                        }
                    }
                    reject(res);
                }
            });
        }

        async function searchAgency(agencyId) {
            await createManagementClient();
            return new Promise(function (resolve, reject) {
                management_client
                    .db(MANAGEMENT_DB_NAME)
                    .collection('agencies')
                    .findOne({ _id: mongodb.ObjectId(agencyId) },
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

        async function writeTransportLine(transportLine) {
            await createEntriesDeparturesClient();
            // Write the entry to the database.
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportLine')
                    .insertOne(transportLine,
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

    async function DELETE_transport_line() {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        if (requestedID) {
            try {
                await deleteTransportLine(requestedID);
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

        async function deleteTransportLine(transportLineId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('TransportLine')
                    .deleteOne({ _id: mongodb.ObjectId(transportLineId) },
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
    function createManagementClient() {
        return new Promise(function (resolve, reject) {
            if (!management_client) {
                mongodb.MongoClient.connect(connection_Management,
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
                        management_client = _management_client;
                        resolve();
                    });
            }
            else {
                resolve();
            }
        });
    }

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
