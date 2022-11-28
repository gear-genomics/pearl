#! /usr/bin/env python

import os
import uuid
import re
import subprocess
import argparse
import json
from subprocess import call
from flask import Flask, send_file, flash, send_from_directory, request, redirect, url_for, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

PEARLWS = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)
app.config['PEARL'] = os.path.join(PEARLWS, "..")
app.config['UPLOAD_FOLDER'] = os.path.join(app.config['PEARL'], "data")
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024   #maximum of 8MB
app.config['MAX_NUMBER_TRACE_FILES'] = 30

def allowed_trace_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in set(['scf','abi','ab1','ab!','ab'])

def allowed_fa_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in set(['fasta', 'fa', 'fas'])

@app.route('/api/v1/upload', methods=['POST'])
def upload_file():
    if request.method == 'POST':
        uuidstr = str(uuid.uuid4())

        # Get subfolder
        sf = os.path.join(app.config['UPLOAD_FOLDER'], uuidstr[0:2])
        if not os.path.exists(sf):
            os.makedirs(sf)

        # Experiment
        queryFileNames = []
        if 'showExample' in request.form.keys():
            for i in range(1, 10): # For testing reduce from 10 to 5
                queryFileNames.append(os.path.join(PEARLWS, "sample_" + str(i) + ".abi"))
            refFileName = os.path.join(PEARLWS, "sample.fa")
        else:
            if "queryFilesCount" not in request.form.keys():
                return jsonify(errors=[{"title": "Illegal request: queryFilesCount is missing!"}]), 400
            traceNr = int(request.form["queryFilesCount"])
            if traceNr < 0:
                traceNr = 0
            if traceNr > app.config['MAX_NUMBER_TRACE_FILES']:
                traceNr = app.config['MAX_NUMBER_TRACE_FILES']
            for i in range(0, traceNr):
                if 'queryFile_' + str(i) not in request.files:
                    return jsonify(errors = [{"title": "Chromatogram file " + str(i) + " is missing!"}]), 400
                queryFile = request.files['queryFile_' + str(i)]
                if queryFile.filename == '':
                    return jsonify(errors = [{"title": "Chromatogram file " + str(i) + " name is missing!"}]), 400
                if not allowed_trace_file(queryFile.filename):
                    return jsonify(errors = [{"title": "Chromatogram file \"" + queryFile.filename + "\" has incorrect file type!"}]), 400
                queryFileName = os.path.join(sf, "pearl_" + uuidstr + "_" + secure_filename(queryFile.filename))
                queryFileNames.append(queryFileName)
                queryFile.save(queryFileName)

            if 'referenceFile' not in request.files:
                refFileName = ""
            else:
                refFile = request.files['referenceFile']
                if refFile.filename == '':
                    return jsonify(errors = [{"title": "Fasta file is missing!"}]), 400
                if not allowed_fa_file(refFile.filename):
                    return jsonify(errors = [{"title": "Fasta file has incorrect file type!"}]), 400
                refFileName = os.path.join(sf, "pearl_" + uuidstr + "_" + secure_filename(refFile.filename))
                refFile.save(refFileName)

        # Run sage
        outfile = os.path.join(sf, "pearl_" + uuidstr)
        logfile = os.path.join(sf, "pearl_" + uuidstr + ".log")
        errfile = os.path.join(sf, "pearl_" + uuidstr + ".err")
        with open(logfile, "w") as log:
            with open(errfile, "w") as err:
                refArr = []
                if refFileName != "":
                    refArr = ['-r', refFileName]
                try: 
                    return_code = call(['tracy', 'assemble', '-o', outfile] + refArr + queryFileNames, stdout=log, stderr=err)
                except OSError as e:
                    if e.errno == os.errno.ENOENT:
                        return jsonify(errors = [{"title": "Binary ./tracy not found!"}]), 400
                    else:
                        return jsonify(errors = [{"title": "OSError " + str(e.errno)  + " running binary ./tracy!"}]), 400
        if return_code != 0:
            errInfo = "!"
            with open(errfile, "r") as err:
                errInfo = ": " + err.read()
            return jsonify(errors = [{"title": "Error in running pearl" + errInfo}]), 400
        return jsonify(data = json.loads(open(os.path.join(sf, "pearl_" + uuidstr + ".json")).read()))
    return jsonify(errors = [{"title": "Error in handling POST request!"}]), 400

@app.route('/api/v1/health', methods=['GET'])
def health():
    return jsonify(status="OK")

if __name__ == '__main__':
    app.run(host = '0.0.0.0', port=3300, debug = True, threaded=True)
