 exports.base64ToFile = (base64String, fileName = "image.png") => {
    try {
        // Check if the base64 string is valid
        if (!base64String || typeof base64String !== "string") {
            throw new Error("Invalid base64 string");
        }

        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const dataURIPrefix = "data:image/jpeg;base64,";
        if (base64String.startsWith(dataURIPrefix)) {
            base64String = base64String.slice(dataURIPrefix.length);
        }

        // Convert base64 to binary data (Buffer)
        const binaryData = Buffer.from(base64String, 'base64');

        // Create a custom file-like object with properties similar to a File
        const customFile = {
            name: fileName,
            size: binaryData.length,
            type: "image/png",
            buffer: binaryData,
        };

        return customFile;
    } catch (error) {
        console.error("Error converting base64 to file:", error);
        return null; // or throw the error if you want to propagate it
    }
  };