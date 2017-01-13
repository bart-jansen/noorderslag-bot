/*-----------------------------------------------------------------------------
This template demonstrates how to use an IntentDialog with a LuisRecognizer to add
natural language support to a bot.
For a complete walkthrough of creating this type of bot see the article at
http://docs.botframework.com/builder/node/guides/understanding-natural-language/
-----------------------------------------------------------------------------*/
// "use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var locationDialog = require('ivo-botbuilder-location');
var fetch = require('node-fetch');
var Forecast = require('forecast');
var moment = require("moment");
var youtube = require("youtube-api");
var async = require("async");

var request = require('request');
var syncRequest = require('sync-request');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});


var HELP_TEXT = "Hi! I'm Sonic, They also call me 'know it all', because I know everything about Eurosonic/Noorderslag! Try me, I dare you.<br/>" +
    '<br/><br/>Some examples are:<br/>'+
    '- When is Blaudzun playing?<br/>' +
    '- Who is playing near me?<br/>' +
    '- Who is playing tomorrow at 21:00?<br/>' +
    "Questions which I can't answer, will be rooted to my real-life friends.";

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

var functions = require('./functions');

// intents
var getByGenre = require('./intents/get-by-genre');


var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

var lineupContents = fs.readFileSync(__dirname + '/data/lineup.json');
var lineup = JSON.parse(lineupContents);

// add seperate artist list
var artists = [];
var venues = ['3FM stage - Ebbingekwartier','De Oosterpoort Benedenzaal 1 - Kelder','De Oosterpoort Foyer Grote Zaal','De Oosterpoort Grote Zaal','De Oosterpoort Kleine Zaal','De Oosterpoort Restaurant - Marathonzaal','Grand Theatre main','Grand Theatre up','Huize Maas front','Huize Maas main','Mutua Fides','Vera'];

events.forEach(function(event) {
    artists.push(event.description);
});

var m = new Matcher({values: artists,threshold: 3});

/*
foodCategory global
not nice, no priority at this moment to do it otherwise
*/

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

var youtubeApiKey = process.env.YoutubeApiKey;

function getArtist(artistName) {
    var returnVal;

    if(m.get(artistName)) {
        returnVal = events[artists.indexOf(m.get(artistName))]
    }

    return returnVal;
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

function getSong(band, callback) {
    request.get({
        url: 'https://api.spotify.com/v1/search',
        qs: {
            q: band,
            type: 'artist,track'
        }
    },
    function (error, response, body) {
        body = JSON.parse(body);
        callback(error, body);
    });
}

function getVideos(artistName, callback) {
    youtube.search.list({
        part: 'snippet',
        type: 'video',
        order: 'viewCount',
        maxResults: 3,
        q: artistName,
        key: youtubeApiKey
    }, function(error, request, response) {
        callback(error, response.body.items);
    });
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
                session.send('cant find artist');
                // session.send('Oops, I can\'t find the artist \'%s\'.', result.response);
            }

            // session.send("Ok... Found the '%s' band.", eventData.description);
        } else {
            session.send("Cannot get band");
        }
    }])

    .matches('getTimetable', [function (session, args, next)  {

        var time = builder.EntityRecognizer.resolveTime(args.entities);
        var venue = builder.EntityRecognizer.findEntity(args.entities, 'venue');

        session.send(moment(time).isValid() ? 'test' : 'new test');


        var data = session.dialogData.data = {
          venue: venue ? venue.entity : null,
          time: time ? time.toString() : null,
          timestamp: time ? (time.getTime() - (60 * 60 * 1000)) : null //timezone diff with UTC
        };

        if (!venue && !time) {
            builder.Prompts.text(session, "What venue are you looking for?");
        } else {

            next();
        }
    },
    function (session, results) {
        if(session.dialogData && session.dialogData.data.time) {
            if(session.dialogData.data.time.indexOf('00:00:00') !== -1) {
                //look for full day
                session.send('Here is the whole day. That\'s a lot!');

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

                if(cards.length > 0) {

                    // create reply with Carousel AttachmentLayout
                    var reply = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cards);

                    session.send(reply);
                }
                else {
                    session.send('Unfortunately nobody is playing at that time.')
                }
            }
        }
        else {
            var venueSearch = functions.searchVenue(session.dialogData.data.venue.toString());
            session.send(JSON.stringify(venueSearch));

            if(venueSearch.length === 1) {
                session.send('found ' + venueSearch[0]);

                var foundEvents = functions.searchEventByVenue(venueSearch[0]);

                var cards = [];
                foundEvents.forEach(function (event) {
                    cards.push(createCard(session, event));
                });

                if(cards.length > 0) {

                    // create reply with Carousel AttachmentLayout
                    var reply = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cards);

                    session.send(reply);
                }
                else {
                    session.send('Unfortunately nobody is playing at that venue.')
                }

            }
            else if(venueSearch.length > 1) {
                session.send('Which venue do you mean?');
                venueSearch.forEach(function(venue) {
                    session.send('- ' + venue)
                });


                builder.Prompts.choice(session, "What is the right one?", venueSearch);
            }
            else {
                session.send('I can\'t find it. Sorry.');
            }
        }
    }, function (session, results) {
        if (results.response) {

            var foundEvents = functions.searchEventByVenue(results.response.entity);

            var cards = [];
            foundEvents.forEach(function (event) {
                cards.push(createCard(session, event));
            });

            if(cards.length > 0) {

                // create reply with Carousel AttachmentLayout
                var reply = new builder.Message(session)
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(cards);

                session.send(reply);
            }
            else {
                session.send('Unfortunately nobody is playing at that venue.')
            }

        } else {
            session.send("ok");
        }
    }])
    .matches('getLocation', [function (session) {
            var options = {
                prompt: "I will try to find some great music close to you! Where are you now?",
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

                session.send("Party going on 300m from you! at " + JSON.stringify(place));
            }
        }
    ])
    .matches('getFood', [function(session, args, next) {
        foodCategory = builder.EntityRecognizer.findEntity(args.entities, 'foodCategory');
        if(!foodCategory){
            builder.Prompts.text(session, "What do you wanna eat?");
        } else {
            next({response: foodCategory.entity })

        }
    },
      function(session, results){
          var options = {
              prompt: capitalize(results.response) + "! I know a great place! Where are you now?",
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
            session.sendTyping();
            var googleMapsApiKey = process.env.GoogleMapsApiKey;
            var lng = results.response['geo']['longitude'];
            var lat = results.response['geo']['latitude'];
            var dumFoodCategory=foodCategory;
            request.get({
                url: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=' + googleMapsApiKey + '&location='+lat+','+lng+'&rankby=distance&opennow&types=bar|cafe|food|restaurant&keyword='+dumFoodCategory.entity,
            },
            function (error, response, body) {
                if (error || response.statusCode != 200) {
                    session.send('Oops! That place I knew is gone...');
                } else {
                    json = JSON.parse(body);
                    if (json.results || json.results.length > 0) {
                        var cards = [];

                        try {
                            for (var i = 0; i < json.results.length; i++) {
                                var location = json.results[i]
                                if (cards.length >= 5) {
                                    throw BreakException;
                                }
                                if (location.photos != undefined && location.photos.length > 0) {
                                    var response = syncRequest(
                                        'GET',
                                        'https://maps.googleapis.com/maps/api/place/photo?key=' + googleMapsApiKey + '&photoreference=' + location.photos[0].photo_reference + '&maxheight=256',
                                        {
                                            "followRedirects": false
                                        }
                                    );
                                    if (response.statusCode != 302) {
                                        console.log('error loading: https://maps.googleapis.com/maps/api/place/photo?key=' + googleMapsApiKey + '&photoreference=' + location.photos[0].photo_reference + '&maxheight=256')
                                    } else {
                                        var card = new builder.HeroCard(session)
                                            .title(location.name)
                                            .subtitle(location.vicinity)
                                            .images([builder.CardImage.create(session, response.headers.location)])
                                            .buttons([builder.CardAction.openUrl(session, 'http://maps.google.com/?daddr=' + location.geometry.location.lat + ',' + location.geometry.location.lng + '&saddr=' + lat + ',' + lng, 'Get directions')]);
                                        console.log('push card');
                                        cards.push(card);
                                    }
                                }
                            }
                        } catch (e) {
                        } //just for ending the loop early

                        if (cards.length != 0) {
                            var reply = new builder.Message(session)
                                .attachmentLayout(builder.AttachmentLayout.carousel)
                                .attachments(cards);

                            session.send(reply);
                        } else {
                            session.send('Oops! That place I knew is gone...');
                        }
                    } else {
                        session.send('Oops! That place I knew is gone...');
                    }
                }
            });
        } else {
            session.send('Oops! That place I knew is gone...');
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
                builder.Prompts.text(session, "What artist or band are you looking for?");
            } else {
                next({ response: band.entity });
            }
        },
        function (session, results) {
            if (!results.response) {
                session.send('Ok');
            }
            var eventData = getArtist(results.response);

            if (!eventData) {
                session.send('Oops, I can\'t find \'%s\'.', result.response);
                return;
            }

            var band = eventData.description;

            async.parallel([
                function(callback) {
                    getSong(band, function(error, songData) {
                        if (error) {
                            callback(error);
                            return;
                        }
                        var card = createSongCard(session, songData, eventData);
                        callback(null, card);
                    });
                },
                function(callback) {
                    getVideos(eventData.description, function(error, videos) {
                        if(error) {
                            callback(error);
                            return;
                        }
                        var msg = new builder.Message(session);
                        var cards = [];
                        videos.forEach(function(videoData) {
                            var card = createVideoCard(session, videoData);
                            cards.push(card);
                        });
                        callback(null, cards);
                    });
                }],
                function(error, results) {
                    if (error) {
                        session.send('Sorry, there was an error.');
                        return;
                    }

                    var cards = [];
                    cards.push(results[0]);
                    cards = cards.concat(results[1]);
                    var reply = new builder.Message(session)
                        .attachmentLayout(builder.AttachmentLayout.carousel)
                        .attachments(cards);
                    session.send(reply);
                }
            );
        }
    ])
    .matches('getByGenre', getByGenre(lineup))
    .onDefault((session) => {
        session.sendTyping();
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
           if (error || response.statusCode != 200 || body.score < 70 ) {
                var randomMsgs = ['Sorry. I did not understand you. Or are you a little drunk?',
                'Sure. Please talk again and try to understand me ;)',
                "I'm still broke from last night. Please, can you be more specific?",
                "I am not as smart as you, what do you mean?",
                "You are amazing! But I am afraid I don't know what you mean.",
                "I don't know. Can I help you with anything else?",
                "This is above my paygrade, topsecret",
                "I wanna help, but I don't know how"];

                session.send(randomMsgs[Math.floor(Math.random() * randomMsgs.length)])
                // session.send('Sorry, I did not understand \'%s\'.', session.message.text);
            }
            else{
                session.send(body.answer)
            }
        });
    });
    // .onBegin(function (session, args, next) {
    //     // session.dialogData.name = args.name;
    //     session.send(HELP_TEXT);
    //     next();
    // });

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

function createSongCard(session, songData, eventData) {
    var songSpotifyURL = songData.artists.items[0].external_urls.spotify;
    var imageURL = songData.artists.items[0].images[0].url;
    var card = new builder.HeroCard(session)
        .title(eventData.description)
        .text(eventData.text)
        .images([builder.CardImage.create(session, imageURL)])
        .buttons([
            builder.CardAction.openUrl(session, songSpotifyURL, 'Play on Spotify')
        ]);
    return card;
}

function createVideoCard(session, videoData) {
    var card = new builder.HeroCard(session)
        .title(videoData.snippet.title)
        .text(videoData.snippet.description)
        .images([builder.CardImage.create(session, videoData.snippet.thumbnails.high.url)])
        .buttons([builder.CardAction.openUrl(session, 'https://youtu.be/' + videoData.id.videoId, 'Play video')]);
    return card;
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

function capitalize(str) {
  if (str.length) {
    return str[0].toUpperCase() + str.substr(1).toLowerCase();
  } else {
    return '';
  }
}
