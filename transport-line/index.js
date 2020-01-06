const mongodb = require('mongodb');

// URI for MongoDB Atlas
const uri = 'mongodb+srv://lalo:7EXlGBwqcI4u71ZQ@prueba-nztlg.mongodb.net/sssirsa?retryWrites=true&w=majority';

module.exports = function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    // if (req.query.name || (req.body && req.body.name)) {
    //     context.res = {
    //         // status: 200, /* Defaults to 200 */
    //         body: "Hello " + (req.query.name || req.body.name)
    //     };
    // }
    // else {
    //     context.res = {
    //         status: 400,
    //         body: "Please pass a name on the query string or in the request body"
    //     };
    // }

    context.log('Running');
    mongodb.MongoClient.connect(uri, function (error, client) {
        if (error) {
            context.log('Failed to connect');
            context.res = { status: 500, body: res.stack }
            return context.done();
        }
        context.log('Connected');

        client.db('sssirsa').collection('subsidiaries').find().toArray(function (error, docs) {
            if (error) {
                context.log('Error running query');
                context.res = { status: 500, body: res.stack }
                return context.done();
            }

            context.log('Success!');
            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ res: docs })
            };
            context.done();
        });
    });

};