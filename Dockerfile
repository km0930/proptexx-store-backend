# Use an official Node.js runtime as a base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the application dependencies
RUN npm install && npx playwright install

# Copy the rest of the application code to the container
COPY . .

# Expose the port your app runs on
EXPOSE 5000

# Use CMD to start your application
CMD ["npm", "start"]
