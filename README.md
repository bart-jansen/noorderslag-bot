# Eurosonic Noorderslag bot

Main script in messages/index.js

## Install instructions
- Clone/fork this repository
- Set up all required environment variables in `/messages/.env`
- `npm start`
- Test bot with the BotFramework emulator


## Functionalities
All functionalies of the bot are listed below:

### Help (Intent: WhatCanIDo)
Displays all functionalities of the bot, i.e.:

`Hi! I'm Sonic, They also call me 'know it all', because I know everything about Eurosonic Noorderslag!
    Some examples are:
    - When is Blaudzun playing? +
    - Who is playing tomorrow at 21:00?+
    - What hiphop band is playing tonight at 21:00?
    Questions which I can't answer, will be rooted to my real-life friends.`

### Band/Artist lookup (Intent: getData)
Search for a band/artist which returns a detailed card about the performance

### Look for venue (Intent: getTimetable)
Look for specific time/venue to see which band/artists plays

### Weather (Intent: getWeatherData)
Use the following environment variables to provide the application with the right keys:
`DarkSkyKey` - this is the API key for Dark Sky
`DarkSkyLatLng` - this is the lat/lng for the location, format `x,y`
`DarkSkyIconsPrefix` - this is the prefix for the location of the icons. The icons are in SVG format. Use a trailing slash in the URL.

### Spotify and Youtube (Intent: getSong)
Use the following environment variable to provide the application with the right key:
`YoutubeApiKey` - this is the API key for Youtube, get it from developers.google.com


### Food places (Intent: getFood)
Returns food places nearby you based on your location