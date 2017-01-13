/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add
natural language support to a bot.
For a complete walkthrough of creating this type of bot see the article at
http://docs.botframework.com/builder/node/guides/understanding-natural-language/
-----------------------------------------------------------------------------*/
// "use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var locationDialog = require('botbuilder-location');
var fetch = require('node-fetch');
var Forecast = require('forecast');
var moment = require("moment");

var request = require('request');
var syncRequest = require('sync-request');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

var HELP_TEXT = 'Hi there, my name is Sonic! I can help you find your favorite ESNS events, ask my anything ;)<br/>' +
            'Some examples are:<br/>'+
            '- When is blaudzun playing?<br/>' +
            '- Who is playing near me?<br/>' +
            '- Who is playing tomorrow at 21:00?';

var bot = new builder.UniversalBot(connector);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'api.projectoxford.ai';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

//load json
var fs = require("fs");
var Matcher = require('did-you-mean');
var request = require('request');


var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

// add seperate artist list
var artists = [];
var venues = ['3FM stage - Ebbingekwartier','De Oosterpoort Benedenzaal 1 - Kelder','De Oosterpoort Foyer Grote Zaal','De Oosterpoort Grote Zaal','De Oosterpoort Kleine Zaal','De Oosterpoort Restaurant - Marathonzaal','Grand Theatre main','Grand Theatre up','Huize Maas front','Huize Maas main','Mutua Fides','Vera'];

events.forEach(function(event) {
    artists.push(event.description);
});

var m = new Matcher({values: artists,threshold: 6});

var foodCategory={};
var darkSkyKey = process.env.DarkSkyKey;
var darkSkyLatLng = process.env.DarkSkyLatLng;
var darkSkyIconsPrefix = process.env.DarkSkyIconsPrefix;

// Initialize Forecast
var forecast = new Forecast({
  service: 'darksky',
  key: darkSkyKey,
  units: 'celcius',
  cache: true,      // Cache API requests
  ttl: {            // How long to cache requests. Uses syntax from moment.js: http://momentjs.com/docs/#/durations/creating/
    minutes: 15,
    seconds: 00
  }
});

function getArtist(artistName) {
    var returnVal;

    if(m.get(artistName)) {
        returnVal = events[artists.indexOf(m.get(artistName))]
    }

    return returnVal;
}

function searchVenue(searchString) {
    var venueList = [];
    venues.forEach(function(venue) {
        if(venue.toLowerCase().indexOf(searchString.toLowerCase()) !== -1) {
            // count++;
            venueList.push(venue);
            // console.log('found match');

        }

        return venueList;
    })
}

function findEvents(searchTime, endTime) {
    var foundEvents = [];
    events.forEach(function(event) {
        if(endTime) {
            if((event.start * 1000) > searchTime && (event.end*1000) < endTime)
                foundEvents.push(event);
        }
        else {
            if(searchTime >= (event.start * 1000) && searchTime < (event.end*1000))
                foundEvents.push(event);
        }
    });

    return foundEvents;
}

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
    .matches('whatCanIDo', function(session, args) {
        session.send(HELP_TEXT);
    })
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

            if(eventData) {
                var card = createCard(session, eventData);

                var msg = new builder.Message(session).addAttachment(card);
                session.send(msg);
            }
            else {
                session.send('Sorry, I could not find the artist \'%s\'.', result.response);
            }

            // session.send("Ok... Found the '%s' band.", eventData.description);
        } else {
            session.send("Ok");
        }
    }])
    .matches('getTimetable', [function (session, args, next)  {
        var venue = builder.EntityRecognizer.findEntity(args.entities, 'venue');
        // var datetime = builder.EntityRecognizer.findEntity(intent.entities, 'datetime');
        var time = builder.EntityRecognizer.resolveTime(args.entities);

        var data = session.dialogData.data = {
          venue: venue ? venue.entity : null,
          time: time ? time.toString() : null,
          timestamp: time ? (time.getTime() - (60 * 60 * 1000)) : null, //timezone diff with UTC
          timestampOffset: + time.getTimezoneOffset()
        };

        session.send('testing');

        // Prompt for title
        if (!data.venue && !data.time) {
            builder.Prompts.text(session, 'What venue are you looking for?');
        } else {
            next({ response: venue.entity });
        }
    },
    function (session, results) {
        session.send(results.response);

        session.send(JSON.stringify(session.dialogData.data));

        if(session.dialogData && session.dialogData.data.time) {
            if(session.dialogData.data.time.indexOf('00:00:00') !== -1) {
                //look for full day
                session.send('full day');

                var endTime = (24 * 60 * 60 * 1000) + session.dialogData.data.timestamp;

                var foundEvents = findEvents(session.dialogData.data.timestamp, endTime);

                var cards = [];
                foundEvents.forEach(function (event) {
                    cards.push(createCard(session, event));
                });

                // create reply with Carousel AttachmentLayout
                var reply = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
            }
            else {
                var foundEvents = findEvents(session.dialogData.data.timestamp);

                var cards = [];
                foundEvents.forEach(function (event) {
                    cards.push(createCard(session, event));
                });
                console.log('test');

                if(cards.length > 0) {

                    // create reply with Carousel AttachmentLayout
                    var reply = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cards);

                    session.send(reply);
                }
                else {
                    // session.send('Unfortunately nobody is playing at that time..')
                }
            }
        }
        else {
            // session.send('venue');
        }
    }])
    .matches('getLocation', [function (session) {
            var options = {
                prompt: "I will try to find some parties close to you! Where are you currently located?",
                useNativeControl: true,
                reverseGeocode: true,
                requiredFields:
                    locationDialog.LocationRequiredFields.streetAddress |
                    locationDialog.LocationRequiredFields.locality |
                    locationDialog.LocationRequiredFields.postalCode |
                    locationDialog.LocationRequiredFields.country
            };

            locationDialog.getLocation(session, options);
        },
        function (session, results) {
            if (results.response) {
                var place = results.response;
                // session.send("Thanks, I will ship to " + locationDialog.getFormattedAddressFromPlace(place, ", "));
                var lat = place.geo.latitude;
                var lng = place.geo.longitude;

                session.send("Party going on 300m from you! at  " + JSON.stringify(place));
            }
        }
    ])
    .matches('getFood', [function(session, args, next) {
        foodCategory = builder.EntityRecognizer.findEntity(args.entities, 'foodCategory');
        if(!foodCategory){
            builder.Prompts.text(session, "What kind of food are you looking for?");
        } else {
            next({response: foodCategory.entity })

        }
    },
      function(session, results){
          var options = {
              prompt: "I will try to find a place where you can eat " + results.response + "! Where are you now?",
              useNativeControl: true,
              reverseGeocode: true,
              requiredFields: locationDialog.LocationRequiredFields.streetAddress |
              locationDialog.LocationRequiredFields.locality |
              locationDialog.LocationRequiredFields.postalCode |
              locationDialog.LocationRequiredFields.country
          };
          locationDialog.getLocation(session, options);
      },
    function(session, results) {

        if(results.response) {
            var googleMapsApiKey = process.env.GoogleMapsApiKey;
            var lng = results.response['geo']['longitude'];
            var lat = results.response['geo']['latitude'];

            request.get({
                url: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=' + googleMapsApiKey + '&location='+lat+','+lng+'&rankby=distance&opennow&keyword=pizza',
            },
            function (error, response, body) {
                if (error || response.statusCode != 200) {
                    session.send('Sorry, I could not find the any locations to eat .', results.response);
                }
                json = JSON.parse(body);
                if(json.results || json.results.length > 0) {
                    var cards = [];
                    json.results.forEach(function (location, i) {
                        if(location.photos != undefined && location.photos.length > 0) {
                            var response = syncRequest(
                                'GET',
                                'https://maps.googleapis.com/maps/api/place/photo?key=' + googleMapsApiKey + '&photoreference=' + location.photos[0].photo_reference + '&maxheight=256',
                                {
                                    "followRedirects": false
                                }
                            );
                            if (error || response.statusCode != 200) {
                                session.send('Sorry, I could not find the any locations to eat .', results.response);
                            }
                            var card = new builder.HeroCard(session)
                                .title(location.name)
                                .subtitle(location.vicinity)
                                .images([builder.CardImage.create(session, response.headers.location)])
                                .buttons([builder.CardAction.openUrl(session, 'http://maps.google.com/?daddr=' + location.geometry.location.lat + ',' + location.geometry.location.lng, 'Get directions')]);
                            console.log('push card');
                            cards.push(card);
                        }
                    });
                    console.log(cards)
                    var reply = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cards);

                    session.send(reply);
                } else {
                    session.send('Sorry, I could not find the any locations to eat .', results.response);
                }
            });
        } else {
            session.send('Sorry, I could not find the any locations to eat .', results.response);
        }
    }])
    .matches('getWeatherData', [function (session, args, next)  {
        session.sendTyping();
        // var time = builder.EntityRecognizer.resolveTime(args.entities);
        forecast.get(darkSkyLatLng.split(","), function(err, weather) { // get forecast data from Dark Sky
          if(err) return console.dir(err);
           var radarReply = new builder.Message(session)
              .attachments([{
                contentType: 'image/gif',
                contentUrl: 'http://api.buienradar.nl/image/1.0/RadarMapNL?w=500&h=512'
              }]);
          session.send(radarReply); // off you go, weather cards!

          var cards = createWeatherCards(session, weather); // create the cards
          var reply = new builder.Message(session)
              .attachmentLayout(builder.AttachmentLayout.carousel)
              .attachments(cards);
          session.send(reply); // off you go, weather cards!
        });
    }])

    .matches('getSong', [
        function (session, args, next)  {
            var band = builder.EntityRecognizer.findEntity(args.entities, 'band');
            if (!band) {
                builder.Prompts.text(session, "What artist/band are you looking for?");
            } else {
                next({ response: band.entity });
            }
        },
        function (session, results) {
            if (! results.response) {
                session.send('Ok');
            }
            var eventData = getArtist(results.response);

            if(!eventData) {
                session.send('Sorry, I could not find the artist \'%s\'.', result.response);
                return;
            }
            var band = eventData.description;

            request.get({
                url: 'https://api.spotify.com/v1/search',
                qs: {
                    q: band,
                    type: 'artist,track'
                }
            },
            function (error, response, body) {
                if (error || response.statusCode != 200) {
                    session.send('Sorry, there was an error.');
                }
                body = JSON.parse(body);
                songSpotifyURL = body.artists.items[0].external_urls.spotify;
                imageURL = body.artists.items[0].images[0].url;
                var card = new builder.HeroCard(session)
                    .title(band)
                    .text(eventData.text)
                    .images([builder.CardImage.create(session, imageURL)])
                    .buttons([
                        builder.CardAction.openUrl(session, songSpotifyURL, 'Play on Spotify')
                    ]);

                session.send(new builder.Message(session).addAttachment(card));
            });
        }
    ])

    .onDefault((session) => {
        request.post({
            url: 'https://westus.api.cognitive.microsoft.com/qnamaker/v1.0/knowledgebases/' + process.env['knowledgeBaseId'] + '/generateAnswer',
            headers: {
                'Ocp-Apim-Subscription-Key': process.env['ocpApimSubscriptionKey'],
                'Content-Type': 'application/json'
            },
            body: {
                'question': session.message.text
            },
            json: true
        }, function(error, response, body ){
           if (error || response.statusCode != 200 || body.score < 90 ) {
                session.send('Sorry, I did not understand \'%s\'.', session.message.text);
            }
            else{
                session.send(body.answer)
            }
        });
    })
    .onBegin(function (session, args, next) {
        // session.dialogData.name = args.name;
        session.send(HELP_TEXT);
        next();
    });

bot.library(locationDialog.createLibrary('AtU1C7ph71-Saztv0uibjAMRGL7u5Kxy_yQJQa0vmmOUWZn1Xz4dhgZPwmfSdg23'));

bot.dialog('/', intents);


function createCard(session, eventData) {

    return new builder.HeroCard(session)
        .title(eventData.description)
        .subtitle(eventData.description + ' — ' + eventData.day + ' ' + eventData.start_time + ' - ' + eventData.end_time + ' at ' + eventData.location)
        .text(eventData.text)
        .images([builder.CardImage.create(session, eventData.img)])
        .buttons([builder.CardAction.openUrl(session, 'https://www.eurosonic-noorderslag.nl' + eventData.link, 'View more details')]);
}

function createWeatherCards(session, weatherData) {
    var cards = [];
    cards.push(new builder.HeroCard(session)
      .title("Current weather in Groningen")
      .subtitle(weatherData.currently.summary + " | " + Math.round(weatherData.currently.temperature, 1) + "˚C")
      .text("The temperature in Groningen is " + Math.round(weatherData.currently.temperature, 1) + "˚C (feels like: " + Math.round(weatherData.currently.apparentTemperature, 1) + "˚C). The forecast is: " + weatherData.hourly.summary.toLowerCase())
      .images([builder.CardImage.create(session, darkSkyIconsPrefix + weatherData.currently.icon + '.svg')])
      .buttons([builder.CardAction.openUrl(session, 'http://www.buienradar.nl/weer/groningen/nl/2755251', 'View details')])
    );
    for (var i = 0; i < Math.min(weatherData.hourly.data.length, 10); i++) {
      if ((i+1) % 3 === 0) {
        var hourlyData = weatherData.hourly.data[i];
        cards.push(new builder.HeroCard(session)
          .title("+" + (i+1) + " hours")
          .subtitle(hourlyData.summary + " | " + Math.round(hourlyData.temperature, 1) + "˚C")
          .text("In " + (i+1) + " hours, the temperature will be: " + Math.round(hourlyData.temperature, 1) + "˚C (feels like: " + Math.round(hourlyData.apparentTemperature, 1) + "˚C)." )
          .images([builder.CardImage.create(session, darkSkyIconsPrefix + hourlyData.icon + '.svg')])

        );
      }
    }
    return cards;
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
