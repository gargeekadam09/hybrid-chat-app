#!/bin/bash
echo "Building React app..."
cd client/hybrid-client
npm install
npm run build
echo "Build complete!"