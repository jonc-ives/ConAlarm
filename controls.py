import sys, trace, multiprocessing, time
from playsound import playsound
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime

class AlarmController: 

	def __init__(self):
		self.debug = ""
		self.port = ""
		self.mongoURI = ""
		self.mongoDB = ""
		self.mongoAlColl = ""
		self.mongoLogColl = ""
		self.mongoPort = ""
		self.active_tiles = []

	def initialize(self, config, thread_flags):
		self.debug = config["debug"]
		self.port = config["port"]
		self.mongoURI = config["mongoURI"]
		self.mongoDB = config["mongoDB"]
		self.mongoAlColl = config["mongoAlColl"]
		self.mongoLogColl = config["mongoLogColl"]
		self.mongoPort = config["mongoPort"]
		self.mongo = self.new_connection()
		self.threads = {}
		self.thread_flags = thread_flags
		self.initialize_threads()

	def initialize_threads(self):
		alarms, useless = self.get_alarms()
		for alarm in alarms:
			if alarm["repeat"]: self.start_alarm_thread(alarm)

	# remember to close connection
	def new_connection(self, log=False):
		connection = MongoClient(self.mongoURI, self.mongoPort)
		db = connection[self.mongoDB]
		return db

	# precondition -- new_alarm is valid
	def new_alarm(self, new_alarm):
		try:	
			new_alarm["mission_count"] = 5
			res = self.mongo.alarms.insert_one(new_alarm)
			if new_alarm["repeat"] != "":
				self.start_alarm_thread(new_alarm)
			return True, res
		except: return False, False

	# precondition -- new_alarm is valid
	def edit_alarm(self, new_alarm, aid, thread=True):
		try:
			new_alarm["_id"] = ObjectId(aid)
			old = self.mongo.alarms.find_one({"_id": ObjectId(aid)})
			new = self.mongo.alarms.replace_one({"_id": ObjectId(aid)}, new_alarm)
			if thread: self.stop_alarm_thread(aid)
			if new_alarm["repeat"] != "" and thread: self.start_alarm_thread(new_alarm)
			return True, new
		except: return False, False

	def delete_alarm(self, aid):
		try:
			old = self.mongo.alarms.find_one({"_id": ObjectId(aid)})
			dead = self.mongo.alarms.delete_one({"_id": ObjectId(aid)})
			self.stop_alarm_thread(aid)
			del self.thread_flags[aid]
			return True, dead
		except: return False, False

	def get_alarms(self, aid=""):
		try:
			for _id in self.threads:
				if self.thread_flags[_id]:
					return (self.mongo.alarms.find_one({"_id": ObjectId(_id)}), True) 

			if (aid == ""): return (list(self.mongo.alarms.find({})), False)
			return self.mongo.alarms.find_one({"_id": ObjectId(aid)}), False
		except: return False, False

	def get_alarm_timer(self, repeat, stime):
		now = datetime.now()
		now_seconds = (now - now.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()
		now_day = now.weekday() + 1
		if now_day == 7: now_day = 0

		alarm_days = [
			True if "d" in repeat else False,
			True if "m" in repeat else False,
			True if "t" in repeat else False,
			True if "w" in repeat else False,
			True if "r" in repeat else False,
			True if "f" in repeat else False,
			True if "s" in repeat else False, 
		]

		seconds_til = 0
		for idx in range(7):
			if not alarm_days[idx]: continue
			fires = (idx * 24 * 60 * 60) + stime
			moment = (now_day * 24 * 60 * 60) + now_seconds
			# adjust for alarm next week
			if moment > fires: fires += (7 * 24 * 60 * 60)
			# now we can calculate the interval
			temp = fires - moment
			# store the decision
			seconds_til = temp if seconds_til < 1 else min(seconds_til, temp)
		return seconds_til

	def start_alarm_thread(self, alarmObj):
		ftime = self.get_alarm_timer(alarmObj["repeat"], alarmObj["stime"])

		self.threads[str(alarmObj["_id"])] = {
			"sys_thread": multiprocessing.Process(target=trace_thread_target, args=(ftime, str(alarmObj["_id"]), self.thread_flags,), daemon=True)
		}

		self.thread_flags[str(alarmObj["_id"])] = False

		self.threads[str(alarmObj["_id"])]["sys_thread"].start()

	def stop_alarm_thread(self, aid):
		try:
			self.threads[str(aid)]["sys_thread"].terminate()
			self.thread_flags[str(aid)] = False
			del self.threads[str(aid)]
		except: print("oops")

def trace_thread_target(ftime, aid, thread_flags):
	print("starting thread countdown")
	time.sleep(ftime)
	thread_flags[str(aid)] = True
	print(thread_flags[str(aid)])
	while thread_flags[str(aid)]:
		playsound('alarm_audio.wav')

