//main page component to set up the basic structure of chat interface
'use client'

import { Box, Button, Stack, TextField } from '@mui/material'
import { useEffect, useState, useRef } from 'react'

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm the Headstarter customer support assistant. How can I help you today?",
    },
  ])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState(null)

  useEffect(() => {
    if(typeof window != 'undefined') {
      //Initialize SpeechRecognition
      const SpeechRecognition = window.SpeechRecogniton || window.webkitSpeechRecognition;
      const recognitionInstance = SpeechRecognition ? new SpeechRecognition() : null;
      setRecognition(recognitionInstance)
    }
  }, [])

  /**
   * This function handles sending the user's message to the server, receiving the streamed response from the OpenAI API,
   * and updating the chat interface in real-time
   */
  const sendMessage = async (voiceMessage = null, isVoiceInput = false) => { 
    const messageToSend = voiceMessage || message;
    if (!messageToSend.trim() || isLoading) return // don't send empty messages
    setIsLoading(true)

    if (!isVoiceInput) {
      setMessage('')//Clear the input field by setting its state to an empty string
    }

    //update the message state to include the user's message and a placeholder for the assistant's response
    setMessages((messages) => [
      ...messages, //spread operator includes all previous messages
      {role: 'user', content: messageToSend}, //Add the user's message to the chat
      {role: 'assistant', content: ''}, //Add a placeholder for the assistant's response
    ]);

    try{
      //send the message to the server
      //send the POST request to the sever endpoint '/api/chat' with the user message
      const response = await fetch('/api/chat', {
        method: 'POST', //specifies the HTTP method
        headers: {
          'Content-Type': 'application/json', //defines the content type as JSON
        },
        body: JSON.stringify([...messages, {role: 'user', content: messageToSend }]), //contains the entire conversation history (including the latest user message) serialized into a JSON str
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      //when the response is sent back to the server
      const reader = response.body.getReader() //to read the response body as a stream of data chunks
      const decoder = new TextDecoder() //decode data into text

      let assistantMessage = ''
      while (true) { //continuously read chunks of the response until the stream is fully consumed
        const { done, value } = await reader.read() 
        if (done) break

        const text = decoder.decode(value, { stream: true }) //decodes the current chunk into a text string
        assistantMessage += text

        setMessages((messages) => {//update the setMessages state to the response to the last recent user's question
          let lastMessage = messages[messages.length - 1] //retrieves the last message in the state, which is the placeholder for the assistant's response
          let otherMessages = messages.slice(0, messages.length - 1) //retrieves all other messages except the last one.
          return [
            ...otherMessages,
            {...lastMessage, content: assistantMessage },
          ]
        })
      }

      //Read out the response using speech synthesis only if isListening is true
      if (isVoiceInput){
        const utterance = new SpeechSynthesisUtterance(assistantMessage);
        speechSynthesis.speak(utterance);
      }

    } catch (error) {//if there is an error sending messages to the server
      console.error('Error:', error)
      setMessages((messages) => [ //set the setMessages state to error message
        ...messages,
        {role: 'assistant', content: "I'm sorry, but I encountered an error. Please try again later."},
      ])
    }
    setIsLoading(false)

    if(isVoiceInput){
      setMessage('') //Clear the input field after sending voice message
    }
}

//sent message to open ai api when user press 'Enter'
const handleKeyPress = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// start recording the voice 
const handleVoiceStart = () => {
  if (recognition) {
    setIsListening(true);
    recognition.start();
  } else {
    alert('Speech recogniton is not supported in this browser.');
  }
}

//stop recording the voice
const handleVoiceStop = () => {
  if (recognition) {
    setIsListening(false);
    recognition.stop();

    if (message.trim()){
      sendMessage(message, true); //pass true to indicate it's a voice message
    }
  }
}

//convert the speech to text and put the input text to openai api
recognition && (recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  setMessage(transcript);
  //sendMessage(transcript);
})

//Auto scrolling to the most recent open ai api response
const messagesEndRef = useRef(null)

const scrollToBottom = () => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
}

useEffect(() => {
  scrollToBottom()
}, [messages])

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      bgcolor={"white"}
    >
      <Stack
        direction={'column'}
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
        bgcolor={"white"}
      >
        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
            >
              <Box
                bgcolor={
                  message.role === 'assistant'
                    ? 'primary.main'
                    : 'secondary.main'
                }
                color="white"
                borderRadius={16}
                p={3}
              >
                {message.content}
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Stack>
        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button variant="contained" onClick={() => sendMessage(null, false)} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>

          {isListening ? (
            <Button variant='contained' onClick={handleVoiceStop}>
              Stop
            </Button>
          ) : (
            <Button variant='contained' onClick={handleVoiceStart}>
              Start Voice
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}