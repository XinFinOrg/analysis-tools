import plotly.graph_objects as go
import json
import numpy as np
import sys
import os
from plotly.subplots import make_subplots

args = sys.argv


if len(args) == 1:
	# load the first json file in the output directory
	files = os.listdir('output')
	jsons = [f for f in files if '.json' in f]
	if len(jsons) == 0:
		assert False # cannit find any json file in the output folder, please download one first
	else:
		blocks = json.load(open('output/' + jsons[0]))
else:
	blocks = json.load(open('output/' + args[1] + '.json'))

targetBlock = input("Please type in the target block: ")

# TARGET_BLOCK = 27307800
TARGET_BLOCK = int(targetBlock)
EPOCH = 900
TARGET_END = TARGET_BLOCK + EPOCH

starting_number = int(blocks[0]['number'])
target_idx = TARGET_BLOCK - starting_number
target_end_idx = target_idx + EPOCH

target_block = blocks[target_idx]

def get_nodes_idx(start_idx, end_idx):
	# label each node from block[start_idx] to block[end_idx] with a number
	# first miner receives index 0.
	miners = []
	validators = []
	signers = []
	for i in range(start_idx, end_idx):
		miners.append(blocks[i]['minerAddress'].lower())
		validators.append(blocks[i]['validatorAddress'].lower())
		signers.extend([s.lower() for s in blocks[i]['signers']])
	num_miners = len(set(miners))
	num_validators = len(set(validators))
	num_signers = len(set(signers))
	# print("number of unique miners:", len(set(miners)))
	# print("number of unique validators:", len(set(validators)))
	# print("number of unique signers:", len(set(signers)))
	# print("number of unique master ndoes (miners + validators):", len(set(miners + validators)))
	# print("number of unique master ndoes (miners + validators + signers):", len(set(miners + validators + signers)))
	node_idx = {}
	count = 0
	for node_list in [miners, signers, validators]:
		for node in node_list:
			if not node in node_idx.keys():
				node_idx[node] = count
				count += 1
	return node_idx


num_epoches_before = int(target_idx / EPOCH)
min_start_idx = target_idx - EPOCH * num_epoches_before
num_epoches_after = int((len(blocks) - target_idx) / EPOCH) + 1
max_end_idx = min(len(blocks), target_idx + EPOCH * num_epoches_after)

# Compute the range of all the complete epochs. Target epoch is always computed even if it is incomplete.
epochs = []
while min_start_idx < max_end_idx:
	epochs.append([min_start_idx, min(min_start_idx + EPOCH, max_end_idx)])
	min_start_idx += EPOCH

# Label the miner and validator of all blocks
miner_list = []
validator_list = []
idx_list = []
for each_epoch in epochs:
	node_idx = get_nodes_idx(each_epoch[0], each_epoch[1])
	for idx in range(each_epoch[0], each_epoch[1]):
		block = blocks[idx]
		miner_list.append(node_idx[block['minerAddress'].lower()])
		validator_list.append(node_idx[block['validatorAddress'].lower()])
		idx_list.append(idx - target_idx)

# plot it
fig = go.Figure()
fig.add_trace(go.Scatter(x=idx_list, y=miner_list, name='miner idx'))
fig.add_trace(go.Scatter(x=idx_list, y=validator_list, name='validator idx'))
fig.update_xaxes(title='block number (0 is block-27307800)')
fig.update_yaxes(title='master node index within the epoch')
fig.show()
