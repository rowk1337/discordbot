/*
 *   Copyright (c) 2020 AmnesiaRP, 
 * 		Created by AzginFR/DoctorWhoFR  
 *	This is a program without any documentation or any information
 * Also there is no Managers or functions this is just full brutal program for displaying FiveM server count on discord channel.
 * I'm not going to provide any support, or maybe for people who find my herself my discord (and for french people).
 
 
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.

 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.

 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const Discord = require('discord.js');
const client = new Discord.Client();
const get = require('simple-get')
var figlet = require('figlet');
var fivem_offline = false

const Gamedig = require('gamedig');
var query = require('game-server-query');

// SMALL CONFIG FOR 1 SERVER
var discord_bot_token = "NDY5ODA2NTg4NjIyOTI5OTM1.XrwWMw.MOFKYecBxhaI4_9OQlvsYIqZ7ME";

var FiveM_ServerAdress = "45.156.84.193"; // your fivme server adress
var Port = "30120" 

var channel_id = "710161651197804675" // Right-Click with dev mod on channel to get Identifier
var maintenance_msg = "Deve estar off digo eu"; // The Maintenance message 

client.on('ready', () => {
	setInterval(function() {
		
		// ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
		// COPY THIS CODE FOR EVERY SERVER YOU HAVE
	
		get.concat('http://' + FiveM_ServerAdress + ':' + Port + '/players.json', function (err, res, data) {
		  if (err) {

				serverDowns();
		
		  } else {
					  var content = data.toString()
					  content = JSON.parse(content)
					  
					  if(content[0] != null){
						prodSetMembers(content.length)
					  } else {
						prodSetMembers(0)
					  }
		  }
		
		})
		
		// ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
	})

	
});

client.login(discord_bot_token);

// ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
// COPY THIS CODE FOR EVERY SERVER YOU HAVE
 
function serverDowns(){
	if(fivem_offline === false)
	{
		setOffline();
	}
}

function setOffline()
{
	channel = client.channels.get(channel_id); // channel id to display
    channel.setName('FUSE RP - ' + maintenance_msg);

	console.log('\x1b[32m%s\x1b\x1b[31m%s\x1b[0m', 'FUSE RP:' , '[OFFLINE]');
}

function prodSetMembers(players)
{
    channel = client.channels.get(channel_id); // channel id to display
    channel.setName('FUSE RP - ' + players + "/1024");
	console.log('\x1b[32m%s\x1b\x1b[31m%s\x1b[0m', 'FUSE RP:' , players+'/1024');
}
// ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
