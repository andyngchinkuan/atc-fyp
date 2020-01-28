import React, { Component, createRef } from "react";
import styled from "styled-components";
import { withStyles } from "@material-ui/core/styles";
import { format } from "date-fns";

import { Flex, Box } from "@rebass/grid";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import Input from "@material-ui/core/Input";
import Button from "@material-ui/core/Button";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import ClearRounded from "@material-ui/icons/ClearRounded";
import RootRef from "@material-ui/core/RootRef";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import MicIcon from '@material-ui/icons/Mic';
import ClearAllIcon from '@material-ui/icons/ClearAll';
import FlightTakeoffIcon from '@material-ui/icons/FlightTakeoff';
import FlightIcon from '@material-ui/icons/Flight';
import MarkupText from "../modules/components/MarkupText";
import Switch from "@material-ui/core/Switch";

import io from 'socket.io-client';
import Record from './Record';

const EXAMPLES = [
  "singapore four runway two zero right continue approach",
  "runway two zero right continue approach singapore four",
  "jet asia two four five vacate echo five contact singapore ground at one two one point eight",
  "swissair three four five pushback approved",
  "request pushback swissair three four five",
  "singapore nine four two pushback completed confirm brakes set",
  "ready to start up speedbird four two",
  "speedbird four nine two decrease speed to two hundred knots and maintain speed",
  "mayday mayday mayday hamburg airways two seven four",
  "crystal-air four two three increase speed to four hundred knots",
  "increase speed to four hundred knots cebu five four",
  "ryanair six seven climb to four thousand feet and maintain flight level",
  "singapore three eight six altimeter setting sea level pressure one zero eight six",
  "far eastern eight three slot time one two three six ",
  "cebu two zero two center wind seven nine zero three zero you are clear to land",
  "red cap one three two clear to enter runway zero two center",
  "malaysia one two three cancel take off clearance vehicle on runway three one right",
  "air canada four three clear to backtrack runway one two left",
  "air seoul four five cleared for takeoff",
  "air ghana four three two taxi to holding area",
  "wokair six four two cross runway two two right",
  "indonesia nine two zero center after the landing firefly six zero and clear to land",
  "indonesia nine two zero speak slower",
  "air macao three six start up approved",
  "indonesia nine two radar contact",
  "california shuttle six contact hong kong departure at one two three decimal eight",
  "musrata air four three contact tokyo tower one one eight point seven"
];

// Styles definition

const styles = theme => ({
  main: {
    padding: 20
  },
  paper: {
    flexGrow: 1,
    padding: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start"
  },
  errorIcon: {
    fontSize: 20,
    marginRight: theme.spacing.unit
  },
  snackbarMessage: {
    display: "flex",
    alignItems: "center"
  }
});

const PaperFlex = styled(Flex)`
  height: 240px;
`;

const LogPaper = styled(Paper)`
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: scroll;
  padding: 8px;
  max-height: 240px;
  max-width: 100%;
`;

const LogEntry = styled.span`
  display: block;
`;

const ControlButton = styled(Button)`
  margin-right: 8px;
`;

// Functions definition

const getCurrentTimeString = () => format(new Date(), "HH:mm:ss");

class Transcription {
  index = 0;
  list = [];

  add = (text, isFinal) => {
    this.list[this.index] = text;
    if (isFinal) {
      this.index++;
    }
  };

  toString = () => {
    return this.list.join(". ");
  };

  clear = () => {
    this.index = 0;
    this.list = [];
  };
}

const debounce = (func, delay) => {
  let inDebounce;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(inDebounce);
    inDebounce = setTimeout(() => func.apply(context, args), delay);
  };
};

class App extends Component {
  constructor(props) {
    super(props);
    this._sendWsMessage = debounce(this._sendWsMessage, 250);
    this.state = {
      text: "",
      output: "",
      highlight: [],
      errorVisible: false,
      exampleValue: "",
      mode: 'record',
      backendUrl: 'http://localhost:3001',
      isSocketReady: false,
      transcription: '',
      partialResult: '',
      status: 0, // 0: idle, 1: streaming, 2: finish
      isBusy: false,
      socket: null,
      switchstate: false
    };
    this.handleSwitch = this.handleSwitch.bind(this);
    this.handleSpeechAreaChange = this.handleSpeechAreaChange.bind(this);
  }
  

  componentDidMount() {
    this.transcription = new Transcription();
    this._handleConnectWs();
    this.initSockets();
  }
  
  initSockets () {
    const socket = io(this.state.backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    })

    socket.on('connect', () => {
      console.log('socket connected!')
    })

    socket.on('stream-ready', () => {
      this.setState({
        isSocketReady: true,
        status: 1
      })
    })

    socket.on('stream-data', data => {
      if (data.type === 'import') {
        if (data.status === 0 && data.message === 'EXIT') {
          this.setState({
            status: 2,
            isBusy: false
          })
        } else {
          this.setState({
            transcription: data.message
          })
        }
      } else {
        if (data.result.final) {
          this.setState(prevState => ({
            transcription: prevState.transcription + ' ' + data.result.hypotheses[0].transcript,
            partialResult: ''
          }))
          this.handleSpeechAreaChange()
        } else {
          this.setState(prevState => ({
            partialResult: '[...' + data.result.hypotheses[0].transcript + ']'
          }))
        }
      }
    })
  
  socket.on('stream-close', () => {
      this.setState({
        status: 2,
        isBusy: false
      })
    })

    this.setState({
      socket
    })
  }

  onTokenChange = (e) => {
    this.setState({
      token: e.target.value
    })
  }

  reset = () => {
    this.setState({
      transcription: '',
      partialResult: ''
    })
  }

  setBusy = () => {
    this.setState({
      isBusy: true
    })
  }

  setStatus = (status) => {
    this.setState({
      status
    })
  }

  changeTab = (tab) => {
    if (this.state.isBusy) {
      const cf = window.confirm('If you change tab, current stream process will be lost')

      if (cf) {
        this.setState({
          mode: tab,
          isBusy: false
        })
        this.reset()
      }
    } else {
      this.setState({
        mode: tab
      })
      this.reset()
    }
  }
   

  logRef = createRef();

  _onWsMessage = e => {
    this.setState({ output: e.data });
  };

  _handleRetryWs = () => {
    this.setState({ errorVisible: false });
    this._handleConnectWs();
  };

  _handleConnectWs = () => {
    this.ws = new WebSocket(process.env.HIGHLIGHTER_BACKEND_URL);

    this.ws.onopen = () => console.log("connected to ws");
    this.ws.onclose = () => this.setState({ errorVisible: true });
    this.ws.onmessage = this._onWsMessage;
  };

  componentWillUnmount() {
    if (this.ws) {
      this.ws.close();
    }
  }

 handleSpeechAreaChange(){
    let transcribedValue = this.state.transcription
    this.setState({text: transcribedValue})
  };

  _handleTextAreaChange = e => {
    this.setState({ text: e.target.value });
  };
  
  _handleSpeechChange = e => {
    this.setState({ transcription:  e.target.value });
  };
  
  _clearInput = () => {
    this.setState({ text: "" });
  };

  handleSwitch(e){
    e.preventDefault();
    let name = e.target.name;
    this.setState({[name]:e.target.checked})
  }

  shouldComponentUpdate(_, nextState) {
    if (nextState.text !== this.state.text) {
      this._sendWsMessage(nextState.text);
    }
    return true;
  }

  _sendWsMessage = message => {
    this.ws.send(message);
  };

  _handleExampleChange = e => {
    if (e.target.value === "") {
      this.setState({
        exampleValue: ""
      });
    } else {
      this.setState({
        text: EXAMPLES[e.target.value],
        exampleValue: e.target.value
      });
    }
  };


  render() {
    const { classes } = this.props;
    const {
      text,
      errorVisible,
      output,
      exampleValue
    } = this.state;
    return (
      <>
        <AppBar position="static" style={{ background: '#3FA6EF' }}>
          <Toolbar>
            <Typography variant="h6" color="default">
              Air Traffic Control NER <FlightTakeoffIcon></FlightTakeoffIcon>
            </Typography>
	    
          </Toolbar>
        </AppBar>
        <Box p={3}>
          <Flex flexWrap="wrap" mb={2}>
            <PaperFlex flexDirection="column" width={[1, 1 / 2]} pr={[0, 2]}>
              <Typography variant="h6">Input text</Typography>
              <Paper className={classes.paper}>
		{/*{this.state.switchstate === false && */}
                <Input
                  multiline
                  fullWidth
                  placeholder="Type here..."
                  onChange={this._handleTextAreaChange }
                  value={text}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton onClick={this._clearInput}>
                        <ClearRounded />
                      </IconButton>
                    </InputAdornment>
            	}
                />
		{/*}
                {
		{this.state.switchstate &&
		<textarea
                value={this.state.transcription + ' ' + this.state.partialResult}
                readOnly
                className={`form-control ${this.state.status === 2 ? 'success' : ''}`}
                rows="8"
                cols="80"
                />
		} */}

              </Paper>
	{/*	<Switch
			checked={this.state.switchstate}
			onChange={this.handleSwitch}
			value="checkedA"
			name="switchstate"
			inputProps={{'aria-label':'secondary checkbox'}}
		/> */}
            </PaperFlex>
            <PaperFlex flexDirection="column" width={[1, 1 / 2]} pl={[0, 2]}>
              <Typography variant="h6">Results</Typography>
              <Paper className={classes.paper}>
                <MarkupText text={output} />
              </Paper>
            </PaperFlex>
          </Flex>

          <Flex flexDirection="column">
            <Flex alignItems="center" py={1}>
              <FormControl fullWidth>
                <InputLabel htmlFor="example-select">
                  Select an example
                </InputLabel>
                <Select
                  value={exampleValue}
                  onChange={this._handleExampleChange}
                  inputProps={{ id: "example-select" }}
                  autoWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {EXAMPLES.map((example, idx) => (
                    <MenuItem value={idx} key={idx}>
                      {example}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Flex>
            <Flex alignItems="center" py={1}>
              <Typography variant="subtitle1">
                Highlighter server status:{" "}
                <strong>{errorVisible ? "Disconnected" : "Connected"}</strong>
              </Typography>
              {errorVisible && (
                <Button color="secondary" onClick={this._handleRetryWs}>
                  Retry
                </Button>
              )}
            
            </Flex>

            <Flex alignItems="center" flexWrap="wrap" py={1}>
              <Box width={[1]} pr={[0, 2]}>
                <TextField
                  label="Token"
                  value={this.state.asrUrl}
                  onChange={this.onTokenChange}
                  fullWidth
                />
              </Box>
            </Flex>
           
            {/*<button onClick={() => this.changeTab('record')} className={`btn btn-tab nav-link ${this.state.mode === 'record' ? 'active' : ''}`}>
                  Recording
                </button>*/}
           <div>
              
                <Record
                  socket={this.state.socket}
                  isBusy={this.state.isBusy}
                  token={this.state.token}
                  isSocketReady={this.state.isSocketReady}
                  backendUrl={this.state.backendUrl}
                  reset={this.reset}
                  setBusy={this.setBusy}
                /> 
            </div>
            <div
              className="form-group transcription"
            >
              <span
                className="is-finish"
              >
                <i className="fal fa-check" />
              </span>
              {/*<textarea
                value={this.state.transcription + ' ' + this.state.partialResult}
                readOnly
                className={`form-control ${this.state.status === 2 ? 'success' : ''}`}
                rows="8"
                cols="80"
              />*/}
            </div>
           
          </Flex>
        </Box>
      </>
    );
  }
}

export default withStyles(styles)(App);
