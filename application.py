from flask import Flask, render_template
from flask_restful import Resource, Api
import endpoints, os, multiprocessing

# configure application -- this'll work for now
config = {
	"mongoURI": "127.0.0.1",
	"mongoDB": "alarmcon",
	"mongoAlColl": "alarms",
	"mongoLogColl": "logs",
	"mongoPort": 27017,
	"debug": True,
	"port": 5000
}

# instantiate server
if __name__ == '__main__':
	manager = multiprocessing.Manager()
	thread_flags = manager.dict({})

    # pass configuration to controller
	controller = endpoints.initialize(config, thread_flags)

	# create server instance
	app = Flask(__name__, template_folder=os.path.dirname(os.path.abspath("application.py")))

	api = Api(app)

	@app.route('/', methods=['GET'])
	def Index():
		print(os.path.dirname(os.path.abspath(__file__)))
		return render_template("index.html")

	# initialize server endpoints
	api.add_resource(endpoints.AlarmInfo, '/alarms')
	api.add_resource(endpoints.AlarmActions, '/alarm/<aid>')
	api.add_resource(endpoints.AlarmHandle, '/handle/<aid>')
	app.run(debug=True)
