var alarms = {}
var activeEdit = ""
var static_server = 'http://127.168.0.23:5000'

var buildPane = function(alarmObj) {
	// create the parent pane
	var pane = document.createElement('div')
	pane.className = 'pane'
	pane.id = alarmObj["_id"]
	pane.innerHTML = 
	`<div class="pane-top">
		<div class="alarm">
			<h3 class="alarm-fires">${getTimeFires(alarmObj)}</h3>
			<h3 class="alarm-title">${alarmObj["title"]}</h3>
		</div>
		<div class="settings" onclick="openEditor('${alarmObj["_id"]}')"></div>
	</div>
	<div class="pane-bottom">
		<ul class="repeat-list">
			<li class="repeat-item ${getActiveDay("d", alarmObj["repeat"])}">S</li>
			<li class="repeat-item ${getActiveDay("m", alarmObj["repeat"])}">M</li>
			<li class="repeat-item ${getActiveDay("t", alarmObj["repeat"])}">T</li>
			<li class="repeat-item ${getActiveDay("w", alarmObj["repeat"])}">W</li>
			<li class="repeat-item ${getActiveDay("r", alarmObj["repeat"])}">R</li>
			<li class="repeat-item ${getActiveDay("f", alarmObj["repeat"])}">F</li>
			<li class="repeat-item ${getActiveDay("s", alarmObj["repeat"])}">S</li>
		</ul>
		<h3 class="time-left">${getTimeLeft(alarmObj)}</h3>
	</div>`.trim()

	// adds the pane to the doc
	document.getElementById('add').after(pane)
}

var openEditor = function(alarmId) {
	alarm = alarms[alarmId]
	activeEdit = alarmId

	// set title
	document.getElementById("edit-title").value = alarm["title"]

	// get time string
	tStr = getTimeFires(alarms[alarmId])

	// set hour
	const hourStr = tStr.match(/[0-9]{2}:/)[0].match(/[0-9]{2}/)[0]
	document.getElementById("hour").value = `${hourStr}`

	// set minute
	const mintStr = tStr.match(/:[0-9]{2}/)[0].match(/[0-9]{2}/)[0]
	document.getElementById("mint").value = `${mintStr}`

	// set am/pm
	const mmStr = tStr.match(/[a-z]{2}/)[0]
	document.getElementById(mmStr).className = "mm"

	// set repeat classes
	document.getElementById("d").className = alarm["repeat"].includes("d") ? "rep" : "nor"
	document.getElementById("m").className = alarm["repeat"].includes("m") ? "rep" : "nor"
	document.getElementById("t").className = alarm["repeat"].includes("t") ? "rep" : "nor"
	document.getElementById("w").className = alarm["repeat"].includes("w") ? "rep" : "nor"
	document.getElementById("r").className = alarm["repeat"].includes("r") ? "rep" : "nor"
	document.getElementById("f").className = alarm["repeat"].includes("f") ? "rep" : "nor"
	document.getElementById("s").className = alarm["repeat"].includes("s") ? "rep" : "nor"

	// hide dash, show editor
	document.getElementById('edit').className = "active"
	document.getElementById('dash').className = "inactive"
}

var closeEditor = function() {
	document.getElementById('edit').className = "inactive"
	document.getElementById('dash').className = "active"
	activeEdit = ""
}

var saveChanges = function() {
	var newAlarm = {"_id": activeEdit}

	// set title
	newAlarm["title"] = document.getElementById("edit-title").value
	
	// lets get the time in hours and minutes
	var newH = parseInt(document.getElementById("hour").value)
	var newM = parseInt(document.getElementById("mint").value)
	// this is important, to adjust from readable to workable
	var morg = false
	if (document.getElementById('am').className.includes('mm')) morg = true
	// let's adjust our hours
	if (morg && newH === 12) newH = 0
	else if (!morg && newH !== 12) newH += 12
	// find the second-start of the day -- assign
	newAlarm["stime"] = (newM * 60) + ((newH * 60) * 60)

	// compile the repeat string
	const d = document.getElementById("d").className.includes('rep') ? 'd' : ''
	const m = document.getElementById("m").className.includes('rep') ? 'm' : ''
	const t = document.getElementById("t").className.includes('rep') ? 't' : ''
	const w = document.getElementById("w").className.includes('rep') ? 'w' : ''
	const r = document.getElementById("r").className.includes('rep') ? 'r' : '' 
	const f = document.getElementById("f").className.includes('rep') ? 'f' : '' 
	const s = document.getElementById("s").className.includes('rep') ? 's' : ''
	newAlarm["repeat"] = `${d}${m}${t}${w}${r}${f}${s}`

	// we can use the repeat str to find active
	newAlarm["active"] = newAlarm["repeat"] ? true : false

	postJSON(`/alarm/${activeEdit}`, newAlarm, (stat, res) => {
		refreshAlarms(false)
		closeEditor()
	})
}

var deleteAlarm = function() {
	delJSON(`/alarm/${activeEdit}`, (stat, res) => {
		refreshAlarms(false)
		delete alarms[activeEdit]
		closeEditor()
	})
}

var addAlarm = function() {
	const now = new Date()	
	// we're gonna calculate now (round minutes to 5)
	const tod = now.getSeconds() + (60 * (Math.floor(now.getMinutes() / 5) * 5 + (60 * now.getHours())))

	// create default
	const newAlarm = {
		"active": false,
		"repeat": "",
		"stime": tod,
		"title": "New Alarm"
	}

	postJSON('/alarms', newAlarm, (stat, res) => {
		refreshAlarms(false)
	})
}

var toggleRepeat = function(day) {
	document.getElementById(day).className = document.getElementById(day).className.includes('rep') ? 'nor' : 'rep'
}

var toggleMM = function(next) {
	prev = (next === "am") ? "pm" : "am"
	document.getElementById(next).className = "mm"
	document.getElementById(prev).className = ""
}

var getActiveDay = function(dstr, rstr) {
	if (!rstr) return 'inactive-day'
	if (rstr.includes(dstr)) 
		return 'active-day'
	return 'inactive-day'
}

var getTimeFires = function(alarmObj) {
	var fires = alarmObj["stime"]
	
	var hours = Math.floor(fires / (60 * 60))
	var m = (hours < 12) ? "am" : "pm"
	if (hours > 12) hours -= 12
	if (hours === 0) hours = 12
	const hstr = `${hours < 10 ? '0' : ''}${hours}`

	fires %= (60 * 60)
	var mints = Math.floor(fires / 60)
	const mstr = `${mints < 10 ? '0' : ''}${mints}`

	return `${hstr}:${mstr} ${m}`
}

var getTimeLeft = function(alarmObj) {
	// let's start by making sure alarm is active
	if (!alarmObj["active"] || alarmObj["repeat"] === "") {
		return "alarm not set"
	}

	var xLeft = function(s, x) { 
		if (s === 0) return ''
		if (s === 1) return `1 ${x} `
		else return `${s} ${x}s `
	}

	var next_day = function(d) { return (d === 6) ? 0 : d + 1 }

	var alarm_days = [
		(alarmObj["repeat"].includes("d")) ? true : false,
		(alarmObj["repeat"].includes("m")) ? true : false,
		(alarmObj["repeat"].includes("t")) ? true : false,
		(alarmObj["repeat"].includes("w")) ? true : false,
		(alarmObj["repeat"].includes("r")) ? true : false,
		(alarmObj["repeat"].includes("f")) ? true : false,
		(alarmObj["repeat"].includes("s")) ? true : false
	]

	const now = new Date()
	const today = now.getDay() * 24 * 60 * 60
	const today_secs = now.getSeconds() + (60 * (now.getMinutes() + (60 * now.getHours())))

	var secs_til, fires, moment, temp
	for (var idx in alarm_days) {
		if (!alarm_days[idx]) continue
		fires = (idx * 24 * 60 * 60) + alarmObj["stime"]
		moment = today + today_secs
		// adjust for alarm next week
		if (moment > fires) fires += (7 * 24 * 60 * 60)
		// now we can calculate the interval
		temp = fires - moment
		// and we can store the decision
		secs_til = isNaN(secs_til) ? temp : Math.min(secs_til, temp)
	}


	// okay, now we can break it apart
	var days_til = Math.floor(secs_til / (24 * 60 * 60))
	secs_til %= (24 * 60 * 60)
	var hours_til = Math.floor(secs_til / (60 * 60))
	secs_til %= (60 * 60)
	var mins_til = Math.floor(secs_til / 60)
	
	// whew. This should handle all of the grammar and stuff.
	return `${xLeft(days_til, 'day')}${xLeft(hours_til, 'hour')}${xLeft(mins_til, 'minute')}`
}

var getJSON = function(url, callback) {
    var req = new XMLHttpRequest()
    req.open('GET', `${static_server}${url}`, true)
    req.responseType = 'json'
    req.onload = function() { callback(status, req.response) }
    req.send()
}

var postJSON = function(url, json, callback) {
	var req = new XMLHttpRequest()
    req.open('POST', `${static_server}${url}`, true)
    req.responseType = 'json'
    req.onload = function() { callback(status, req.response) }
    req.send(JSON.stringify(json))
}

var delJSON = function(url, callback) {
	var req = new XMLHttpRequest()
    req.open('DELETE', `${static_server}${url}`, true)
    req.responseType = 'json'
    req.onload = function() { callback(status, req.response) }
    req.send()
}

var refreshAlarms = function(thread=true) {
	if (document.getElementById("fire").className === "active") return

	getJSON('/alarms', (status, response) => {

		if (response["fire"]) {
			document.getElementById('dash').className = 'inactive'
			document.getElementById('edit').className = 'inactive'
			document.getElementById('fire').className = 'active'
			start_alarm_handle(response["alarms"])
			alarms = response["alarms"]
		} else {
			// destory all of the current panes
			while (document.querySelector(".pane")) {
				document.querySelector(".pane").remove()
			} // add the new panes, build object list
			for (idx in response["alarms"]) {
				alarms[response["alarms"][idx]["_id"]] = response["alarms"][idx]
				buildPane(response["alarms"][idx])
			} // set thread interval
			if (thread) setTimeout(refreshAlarms, 1000 * 60)
		}
	})
}

var correct_tiles, chosen_tiles, working
var start_alarm_handle = function(alarmObj) {
	document.getElementById("title-time").innerHTML = getTimeFires(alarmObj)
	document.getElementById("title-title").innerHTML = alarmObj["title"]
	document.getElementById("mission-left").innerHTML = `${alarmObj["mission_count"]} left`

	// this gets, stores, and shows tile puzzle
	correct_tiles = get_mission_tiles(alarmObj["_id"])
}

var get_mission_tiles = function(aid) {
	working = true
	getJSON(`/handle/${aid}`, (stat, resp) => {
		correct_tiles = resp["tiles"]
		show_tile_puzzle(correct_tiles)
	})
}

var show_tile_puzzle = function(tiles) {
	console.log("showing tiles")
	
	setTimeout(() => {
		document.getElementById(`m${tiles[0]}`).animate({background: ['#e38953', 'initial']}, {duration: 500})
	}, 200)

	setTimeout(() => {
		document.getElementById(`m${tiles[1]}`).animate({background: ['#e38953', 'initial']}, {duration: 500})
	}, 700)

	setTimeout(() => {
		document.getElementById(`m${tiles[2]}`).animate({background: ['#e38953', 'initial']}, {duration: 500})
	}, 1200)

	setTimeout(() => {
		document.getElementById(`m${tiles[3]}`).animate({background: ['#e38953', 'initial']}, {duration: 500})
	}, 1700)

	setTimeout(() => {
		document.getElementById(`m${tiles[4]}`).animate({background: ['#e38953', 'initial']}, {duration: 500})
	}, 2200)

	working = false
	chosen_tiles = []
}

var select_tile = function(tile) {
	if (working) return
	chosen_tiles.push(tile)
	document.getElementById(`m${tile}`).animate({background: ['#e38953', 'initial']}, {duration: 200})
	if (chosen_tiles.length === 5)
		submit_response_tiles()
}

var submit_response_tiles = function() {
	postJSON(`/handle/${alarms["_id"]}`, {"tiles": chosen_tiles}, (stat, resp) => {
		if (!resp["success"]) {
			document.getElementById("fire").animate({background: ['red', 'inital']}, {duration: 120})
			get_mission_tiles(alarms["_id"])
		} else if (resp["success"] && resp["count"] !== 5) {
			document.getElementById("fire").animate({background: ['green', 'inital']}, {duration: 120})
			document.getElementById('mission-left').innerHTML = `${resp["count"]} left`
			alarms["mission_count"] = resp["count"]
			get_mission_tiles(alarms["_id"])
		} else if (resp["success"] && resp["count"] === 5) {
			document.getElementById('dash').className = 'active'
			document.getElementById('fire').className = 'inactive'
			refreshAlarms(false)
		}
	})
}

refreshAlarms()
