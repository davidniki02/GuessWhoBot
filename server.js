const TOKEN = process.env.BOT_TOKEN; // guesswho02bot

var TelegramBot = require('node-telegram-bot-api');
var Clarifai = require('clarifai');
var PImage = require('pureimage');
var fs = require('fs');
var request = require('request');
var streams = require('memory-streams');
var MemoryStream = require('memorystream');
var blur = require("./blur.js");

var clarifai = new Clarifai.App(
    process.env.CLARIFAI_CLIENT_ID,
    process.env.CLARIFAI_CLIENT_SECRET
);

var async = require('asyncawait/async');
var await = require('asyncawait/await');

var TelegramBot = require('node-telegram-bot-api'),
    port = process.env.PORT || 443,
    host = '0.0.0.0', // probably this change is not required
    externalUrl = process.env.CUSTOM_ENV_VARIABLE || 'https://guesswho02bot.herokuapp.com';

var bot;

bot = new TelegramBot(TOKEN, { polling: true });
//bot = new TelegramBot(TOKEN, { webHook: { port: port, host: host } });
//bot.setWebHook(externalUrl + ':443/bot' + TOKEN);

function faceDetection(chatId, url) {
    var filename = new Date().getTime().toString() + '.jpg';

    var memStream = new MemoryStream();
    var stream = request(url).pipe(fs.createWriteStream(filename));

    stream.on('finish', function() {

        var bitmap = PImage.decodeJPEG(fs.readFileSync(filename));
        var ctx = bitmap.getContext('2d');

        clarifai.models.predict("a403429f2ddf4b49b307e318f00e528b", {
            url: url
        }).then(
            function(res) {
                var data = res.outputs[0].data.regions;
                if (data !== null) {

                    for (var i = 0; i < data.length; i++) {
                        blur.stackBlurCanvasRGB(ctx,
                            bitmap.width,
                            bitmap.height,
                            Math.round(data[i].region_info.bounding_box.left_col * bitmap.width),
                            Math.round(data[i].region_info.bounding_box.top_row * bitmap.height),
                            Math.round((data[i].region_info.bounding_box.right_col * bitmap.width) - (data[i].region_info.bounding_box.left_col * bitmap.width)),
                            Math.round((data[i].region_info.bounding_box.bottom_row * bitmap.height) - (data[i].region_info.bounding_box.top_row * bitmap.height)),
                            25);
                    }
                }

                var result = new MemoryStream();
                PImage.encodePNG(bitmap, fs.createWriteStream(filename), function() {
                    bot.sendPhoto(chatId, fs.createReadStream(filename));
                    fs.unlink(filename)
                })
            },
            function(err) {
                console.log(err);
            }
        )
    })
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (msg.text == null) {
        if (!msg.photo)
            return;

        // get largest photo size
        var i = 0;
        var photo = msg.photo[0];
        for (j = 1; j < msg.photo.length; j++) {
            var newPhoto = msg.photo[j];
            if (newPhoto.width > photo.width)
                photo = newPhoto;
        }

        var file_id = photo.file_id;

        bot.getFileLink(file_id)
            .then(fileURI => {
                // upload to clarifai
                faceDetection(chatId, fileURI)
            });
    }

    switch (msg.text) {
        case '/start':
            bot.sendMessage(chatId, 'Hi! Post me a picture to get started');
            break;


        default:
            //printSuggestions(msg);
            break;
    }
});