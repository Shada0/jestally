\# Jestally — Real-Time Indian Sign Language Platform



Jestally is an AI-powered platform that enables real-time recognition and translation of Indian Sign Language (ISL). The system bridges communication gaps between deaf and hearing communities by converting sign language gestures into speech and text.



---



\## Live Demo



Web App  

https://jestally.netlify.app



Camera Recognition  

https://jestally.netlify.app/cam-ext.html



---



\## Features



\- Real-time ISL recognition using MediaPipe

\- Speech/Text to Sign Language translation

\- Chrome extension for universal accessibility

\- Multilingual speech output

\- Cloud-based ML inference



---



\## Technology Stack



Frontend  

HTML  

CSS  

JavaScript  



Computer Vision  

MediaPipe Hands



Machine Learning  

Custom trained gesture recognition model



Cloud  

AWS Lambda  

AWS API Gateway  

Amazon S3  

AWS SageMaker



Deployment  

Netlify



Browser Extension  

Chrome Manifest V3



---



\## System Architecture



Camera Input  

↓  

MediaPipe Hand Tracking  

↓  

Landmark Sequence  

↓  

ML Model (AWS SageMaker)  

↓  

Sign Prediction  

↓  

Speech + Text Output



---



\## Chrome Extension



The extension allows users to:



\- Translate speech/text into ISL

\- Recognize hand gestures

\- Use the system on any website



\### Installation



1 Open Chrome Extensions  

chrome://extensions



2 Enable Developer Mode



3 Click "Load Unpacked"



4 Select the `extension` folder



---



\## Project Structure

jestally

│

├ web

│ ├ index.html

│ ├ cam-ext.html

│ ├ train.html

│ └ logo.png

│

├ extension

│ ├ manifest.json

│ ├ content.js

│ ├ popup.html

│ ├ background.js

│ ├ panel.css

│ └ icons

│

└ docs





---



\## Use Cases



\- Accessibility for deaf communities

\- Educational sign language learning

\- Public service accessibility

\- Inclusive digital communication



---



\## Author



Developed for Hackathon submission.



---



\## License



MIT License

