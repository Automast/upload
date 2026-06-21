# Use a lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app's code
COPY . .

# Force the port to match Northflank's default 8080
ENV PORT=4000
EXPOSE 4000

# Start the server
CMD ["node", "server.js"]
