from flask import Flask, jsonify, render_template, request
from flask_restful import Resource, Api, reqparse
from flask_cors import cross_origin
import controls, random

controller = controls.AlarmController()

def initialize(config, thread_flags):
	controller.initialize(config, thread_flags)

class Index(Resource):

	# returns index.html with info-hook
	def get(self):
		return render_template('index.html')

class AlarmInfo(Resource):

	# info-hook endpoint receiver
	@cross_origin()
	def get(self):
		# get alarms from controller
		alarms, firing = controller.get_alarms()
		if not isinstance(alarms, object):
			return jsonify({"success": False})

		# make alarms json serializable
		if not firing:
			for alarm in alarms:
				alarm["_id"] = str(alarm["_id"])
		else: alarms["_id"] = str(alarms["_id"])

		# return alarms (one in list, if firing)
		return jsonify({'fire': firing, 'alarms': alarms})

	# create a new alarm
	@cross_origin()
	def post(self):
		args = request.get_json(force=True)
		success, alarm = controller.new_alarm(args)
		return jsonify({"result": success})

class AlarmActions(Resource):

	# _____ VERIFY REDUNDANCY _____
	# retrieve alarm from store
	@cross_origin()
	def get(self, aid):
		alarm = controller.get_alarms(aid=aid)
		return jsonify({"result": alarm})

	# edit alarm from store
	@cross_origin()
	def post(self, aid):
		args = request.get_json(force=True)
		args["mission_count"] = 5
		success, alarm = controller.edit_alarm(args, aid)
		return jsonify({"result": success})

	# delete an alarm from store
	@cross_origin()
	def delete(self, aid):
		success, alarm = controller.delete_alarm(aid)
		return jsonify({"result": success})

class AlarmHandle(Resource):

	# get mission question
	@cross_origin()
	def get(self, aid):
		controller.active_tiles = []

		# create random tiles
		for i in range(5):
			rtile = random.randrange(25)
			controller.active_tiles.append(rtile)
	
		return jsonify({"mission": True, "tiles": controller.active_tiles})

	# post mission response
	@cross_origin()
	def post(self, aid):
		valid_entry = True

		# grab the alarm, assert exists and firing
		alarm, useless = controller.get_alarms(aid=aid)
		print(alarm)

		# parse tiles from body arguments
		args = request.get_json(force=True)
		tiles = args["tiles"]

		print(tiles, controller.active_tiles)
		# check the answer for accuracy
		for idx, tile in enumerate(tiles):
			if tile != controller.active_tiles[idx]:
				valid_entry = False

		# decrease the amount of missions left (I.A.)
		if valid_entry and alarm["mission_count"] >= 1:
			alarm["mission_count"] -= 1
			controller.edit_alarm(alarm, aid, thread=False)

		# if finished, reset alarm fire and count
		if valid_entry and alarm["mission_count"] < 1:
			alarm["mission_count"] = 5
			controller.stop_alarm_thread(aid)
			controller.start_alarm_thread(alarm)
			controller.edit_alarm(alarm, aid, thread=False)

		return jsonify({"success": valid_entry, "count": alarm["mission_count"]})