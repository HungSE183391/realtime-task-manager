#!/bin/bash
# Start backend server in background
cd server && npm run dev &

# Wait a bit for backend to start
sleep 3

# Start frontend from project root
cd /home/runner/workspace/client && npm run dev
