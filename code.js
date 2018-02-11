// Tim Porritt 2018

let canvas;
let ctx;
let lastTime;

let eventSource;

let accounts = {};
let links = [];
let received = 0;

var fps = 0, drawFPS, thenFPS = 0;
var then = Date.now();

function init()
{
	canvas = document.getElementById("canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	ctx = canvas.getContext("2d");
	lastTime = Date.now();
	draw();

	eventSource = new EventSource("https://horizon.stellar.org/operations?order=desc&limit=200");
	eventSource.addEventListener('message', receiveData, false);
	eventSource.addEventListener('open', function(e) {
		//console.log("Connection opened");
	}, false);

	eventSource.addEventListener('error', function(e) {
		if (e.readyState == EventSource.CLOSED) {
			console.log("Connection closed");
		}
	}, false);
}

function draw()
{
	ctx.fillStyle = "rgb(10,0,20)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	let n = Math.floor(canvas.width/26);
	let accountsArr = Object.keys(accounts);
	accountsArr.reverse();
	accountsArr.forEach((s,i) => {
		let v = accounts[s];
		let theta = (Math.sqrt(i)*10)*(Math.PI / 10);
		let r = 0 + 5 * theta;
		let x = canvas.width/2 + r*Math.cos(theta);
		let y = canvas.height/2 + r*Math.sin(theta);

		v.x = x;
		v.y = y;
	});

	ctx.strokeStyle = "white";
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	links.forEach(v => {
		if(accounts.hasOwnProperty(v.a) &&
			accounts.hasOwnProperty(v.b))
		{
			let vA = accounts[v.a];
			let vB = accounts[v.b];

			ctx.moveTo(vA.x,vA.y);
			ctx.lineTo(vB.x,vB.y);
		}
	});
	ctx.stroke();

	accountsArr.forEach((s,i) => {
		let v = accounts[s];
		
		if(v.balance < 0)
			ctx.fillStyle = "red";
		else if(v.balance > 0)
			ctx.fillStyle = "green";
		else
			ctx.fillStyle = "white";
		ctx.beginPath();
		ctx.arc(v.x,v.y,5,0,Math.PI*2);
		ctx.fill();
	});

	ctx.font = "18px Garamond";
	ctx.fillStyle = "white";
	ctx.fillText("FPS: " + drawFPS, 8,canvas.height - 8);
	
	fps++;
	var now = Date.now();
	if(now > thenFPS + 1000)
	{
		thenFPS = now;
		drawFPS = fps;
		fps = 0;
	}

	requestAnimationFrame(draw);
}

function receiveData(message)
{
	let jsonData = JSON.parse(message.data);
	// console.log("Message", jsonData);
	received++;

	let v = jsonData;
	if(v.type === "create_account")
	{
		uniqueAdd(accounts,v.account);
		uniqueAdd(accounts,v.funder);

		accounts[v.account].balance += v.starting_balance;
		accounts[v.funder].balance -= v.starting_balance;

		accounts[v.account].interactions.push(v.funder);
		accounts[v.funder].interactions.push(v.account);

		uniqueLinkAdd(v.funder,v.account);
	}
	else if(v.type === "payment")
	{
		uniqueAdd(accounts,v.from);
		uniqueAdd(accounts,v.to);

		accounts[v.from].interactions.push(v.to);
		accounts[v.to].interactions.push(v.from);

		uniqueLinkAdd(v.to,v.from);

		if(v.asset_type === "native")
		{
			accounts[v.to].balance += v.amount;
			accounts[v.from].balance -= v.amount;
		}
	}
	else if(v.type === "path_payment")
	{
		uniqueAdd(accounts,v.from);
		uniqueAdd(accounts,v.to);

		accounts[v.from].interactions.push(v.to);
		accounts[v.to].interactions.push(v.from);

		uniqueLinkAdd(v.to,v.from);

		console.log(jsonData);
	}
	else if(v.type === "manage_offer")
	{
		uniqueAdd(accounts,v.buying_asset_issuer);
		uniqueAdd(accounts,v.selling_asset_issuer);

		accounts[v.buying_asset_issuer].interactions.push(v.selling_asset_issuer);
		accounts[v.selling_asset_issuer].interactions.push(v.buying_asset_issuer);

		uniqueLinkAdd(v.selling_asset_issuer,v.buying_asset_issuer);
	}
	else if(v.type === "create_passive_offer")
	{
		if(v.hasOwnProperty("buying_asset_issuer"))
			uniqueAdd(accounts,v.buying_asset_issuer);
			
		if(v.hasOwnProperty("selling_asset_issuer"))
			uniqueAdd(accounts,v.selling_asset_issuer);
	}
	else if(v.type === "set_options")
	{
		uniqueAdd(accounts,v.source_account);
	}
	else if(v.type === "allow_trust")
	{
		uniqueAdd(accounts,v.trustee);
		uniqueAdd(accounts,v.trustor);

		accounts[v.trustee].interactions.push(v.trustor);
		accounts[v.trustor].interactions.push(v.trustee);

		uniqueLinkAdd(v.trustor,v.trustee);
	}
	else if(v.type === "change_trust")
	{
		uniqueAdd(accounts,v.trustee);
		uniqueAdd(accounts,v.trustor);

		accounts[v.trustee].interactions.push(v.trustor);
		accounts[v.trustor].interactions.push(v.trustee);

		uniqueLinkAdd(v.trustor,v.trustee);
	}
	else if(v.type === "account_merge")
	{
		uniqueAdd(accounts,v.into);

		//Remove deleted account
		if(accounts.hasOwnProperty(v.source_account))
		{
			accounts[v.into].balance += v.source_account.balance;

			delete accounts[v.source_account];
		}
	}
	else if(v.type === "inflation")
	{
		uniqueAdd(accounts,v.source_account);
		console.log(jsonData);
	}
	else if(v.type === "manage_data")
	{
		uniqueAdd(accounts,v.source_account);
	}
	else
	{
		console.log(jsonData);
	}
}

function uniqueAdd(obj,val)
{
	if(!obj.hasOwnProperty(val))
		obj[val] = {
			balance: 0,
			interactions: [],
			x: 0,
			y: 0
		};
}

function uniqueLinkAdd(a,b)
{
	let found = links.some(v => {
		return (v.a === a && v.b === b) || (v.a === b && v.b === a);
	});
	if(!found)
		links.push({
			a: a,
			b: b
		});
}

function stopEvents()
{
	eventSource.close();
}