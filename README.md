# analysis-tools

## How to use?
install node version 14.17.0
run below
```
npm install
START={you pick a number to start} END={You pick a number to end} OUTPUTFILE={You pick a filename to write to} npm run start
```
## To plot after you have a json file in the output folder
Note: The starting block has been set as 27307800, to change the starting block, please update TARGET_BLOCK in the python file
Run the following commend to analyze the first json file in the output folder:
'''
python3 json_analysis.py
'''

Run the following commend to analyze the json file you specify (just provide file name, no need .json)
'''
python3 json_analysis.py file_name
'''

## To install Python3 libraries
 '''
 sudo apt-get install python3-pip
 pip install -U plotly
 pip install -U numpy
 '''
