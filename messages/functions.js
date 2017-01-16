var fs = require('fs');
var request = require('request');
var youtube = require("youtube-api");


var eventContents = fs.readFileSync(__dirname + '/data/events.json');
var events = JSON.parse(eventContents);

var venues = ['3FM stage - Ebbingekwartier','De Oosterpoort Benedenzaal 1 - Kelder','De Oosterpoort Foyer Grote Zaal','De Oosterpoort Grote Zaal','De Oosterpoort Kleine Zaal','De Oosterpoort Restaurant - Marathonzaal','Grand Theatre main','Grand Theatre up','Huize Maas front','Huize Maas main','Mutua Fides','Vera'];

function searchEventByVenue(venue) {
    var foundEvents = [];
    events.forEach(function(event) {
        if(event.location == venue && (event.end*1000) > new Date().getTime()) {
            foundEvents.push(event);
        }
    });

    return foundEvents;
}

function searchVenue(searchString) {
    var venueList = [];

    for(var i = 0; i < venues.length; i++) {
        if(venues[i].toLowerCase().indexOf(searchString.toLowerCase()) !== -1) {
            venueList.push(venues[i]);
        }
    }

    return venueList;
}

function ucFirst(str) {
  if (str.length) {
    return str[0].toUpperCase() + str.substr(1).toLowerCase();
  } else {
    return '';
  }
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
        key: process.env.YoutubeApiKey
    }, function(error, request, response) {
        callback(error, response.body.items);
    });
}


module.exports = {
    searchEventByVenue: searchEventByVenue,
    searchVenue: searchVenue,
    ucFirst: ucFirst,
    getSong: getSong,
    getVideos: getVideos
}
