/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add
natural language support to a bot.
For a complete walkthrough of creating this type of bot see the article at
http://docs.botframework.com/builder/node/guides/understanding-natural-language/
-----------------------------------------------------------------------------*/
// "use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

//load json
var fs = require("fs");
var didYouMean = require('didyoumean');

var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

function getArtist(artistName) {
    didYouMean.returnWinningObject = true;
    return  didYouMean(artistName, events, 'description');
}

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('getData', [function (session, args, next)  {
        var band = builder.EntityRecognizer.findEntity(args.entities, 'band');
        if (!band) {
            builder.Prompts.text(session, "What artist/band are you looking for?");
        } else {
            next({ response: band.entity });
        }
    },
    function (session, results) {
        if (results.response) {
            // // ... save task
            var eventData = getArtist(results.response);

            // // create the card based on selection
            // var card = createCard(eventData, session);

            // // attach the card to the reply message
            // var msg = new builder.Message(session).addAttachment(card);
            // session.send(msg);

                    // create the card based on selection
            // var selectedCardName = 'Hero card';
            var card = createCard(session, eventData);

            // attach the card to the reply message
            var msg = new builder.Message(session).addAttachment(card);
            session.send(msg);



            // session.send("Ok... Found the '%s' band.", eventData.description);
        } else {
            session.send("Ok");
        }
    }])
    // .matches('None', (session, args) => {
    //     session.send('Hi! This is the None intent handler. You said: \'%s\'.', session.message.text);
    // })
    .onDefault((session) => {
        session.send('Sorry, I did not understand \'%s\'.', session.message.text);
    });

bot.dialog('/', intents);

function createCard(session, eventData) {

    var imgArr = ['https://static.eurosonic-noorderslag.nl/fileadmin/_processed_/csm_447975-7613877e911e099ba90ee8c7269e22d8-original_6bb5ab93eb.jpg', 'https://static.eurosonic-noorderslag.nl/fileadmin/_processed_/csm_449270-6c4364cd9878e2750585b230b77d765b-original_e85eb907f1.jpg'];


    return new builder.HeroCard(session)
        .title(eventData.description)
        .subtitle(eventData.description + ' — ' + eventData.day + ' ' + eventData.start_time + ' - ' + eventData.end_time + ' at ' + eventData.location)
        .text(eventData.text)
        .images([builder.CardImage.create(session, eventData.img)])
        .buttons([builder.CardAction.openUrl(session, 'https://www.eurosonic-noorderslag.nl' + eventData.link, 'View more details')]);
}


if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}







