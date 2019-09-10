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
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

import MarkupText from "../modules/components/MarkupText";

const EXAMPLES = [
  "singapore four runway two zero right continue approach",
  "viet nam vacate whiskey five contact ground at one two one eight",
  "cebu two zero two center wind seven nine zero three zero you are clear land",
  "indonesia nine two zero center after the landing firefly six zero and clear to land"
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
      asrLogs: [],
      asrTranscribing: false,
      asrLoading: false,
      asrInitialized: false,
      exampleValue: "",
      asrUrl: process.env.ASR_BACKEND_URL,
      asrStatusUrl: process.env.ASR_BACKEND_STATUS_URL
    };
  }

  _newDictate = () => {
    this.dictate = new window.Dictate({
      server: this.state.asrUrl,
      serverStatus: this.state.asrStatusUrl,
      recorderWorkerPath: "static/js/recorderWorker.js",
      onReadyForSpeech: () => {
        this.setState({ asrLoading: false, asrTranscribing: true });
        this._addAsrLog("READY FOR SPEECH");
      },
      onEndOfSpeech: () => {
        this.setState({ asrLoading: true });
        this._addAsrLog("END OF SPEECH");
      },
      onEndOfSession: () => {
        this.setState({ asrLoading: false, asrTranscribing: false });
        this.dictate.cancel();
        this._addAsrLog("END OF SESSION");
      },
      onServerStatus: () => {},
      onPartialResults: hypos => {
        this.transcription.add(hypos[0].transcript, false);
        this.setState({ text: this.transcription.toString() });
      },
      onResults: hypos => {
        this.transcription.add(hypos[0].transcript, true);
        this.setState({ text: this.transcription.toString() });
      },
      onError: () => {
        this.dictate.cancel();
      },
      onEvent: (_, data) => {
        this._addAsrLog(data);
      }
    });
  };

  componentDidMount() {
    this.transcription = new Transcription();
    this._newDictate();
    this._handleConnectWs();

    (() => {
      this.dictate.cancel();
      // this.dictate.init();
    })();
  }

  logRef = createRef();

  _onWsMessage = e => {
    // const parsedData = JSON.parse(e.data);
    // this.setState({ highlight: parsedData });
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

  _handleTextAreaChange = e => {
    this.setState({ text: e.target.value });
    // this.ws.send(e.target.value);
  };

  _clearInput = () => {
    this.setState({ text: "" });
  };

  _addAsrLog = log => {
    const formattedLog = `${getCurrentTimeString()} ${log}`;
    this.setState(prevState => ({
      asrLogs: [...prevState.asrLogs, formattedLog]
    }));
    this.logRef.current.scrollTo({
      top: this.logRef.current.scrollHeight,
      behavior: "smooth"
    });
  };

  _handleAsrButtonClick = () => {
    this.setState({ asrLoading: true });
    if (this.state.asrTranscribing) {
      this.dictate.stopListening();
      // this.dictate.cancel();
    } else {
      this.dictate.startListening();
    }
  };

  shouldComponentUpdate(_, nextState) {
    if (nextState.text !== this.state.text) {
      this._sendWsMessage(nextState.text);
    }
    return true;
  }

  _sendWsMessage = message => {
    this.ws.send(message);
  };

  _clearAsrLogs = () => {
    this.setState({
      asrLogs: []
    });
  };

  _initializeAsr = () => {
    this._newDictate();
    this.setState({ asrInitialized: true });
    this.dictate.init();
    this.transcription.clear();
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
      asrLogs,
      asrTranscribing,
      asrLoading,
      asrInitialized,
      exampleValue
    } = this.state;
    return (
      <>
        <AppBar position="static" style={{ background: '#3FA6EF' }}>
          <Toolbar>
            <Typography variant="h6" color="default">
              Jeremy's ATC Text Highlighter
            </Typography>
          </Toolbar>
        </AppBar>
        <Box p={3}>
          <Flex flexWrap="wrap" mb={2}>
            <PaperFlex flexDirection="column" width={[1, 1 / 2]} pr={[0, 2]}>
              <Typography variant="h6">Input text</Typography>
              <Paper className={classes.paper}>
                <Input
                  multiline
                  fullWidth
                  placeholder="Type here..."
                  onChange={this._handleTextAreaChange}
                  value={text}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton onClick={this._clearInput}>
                        <ClearRounded />
                      </IconButton>
                    </InputAdornment>
                  }
                />
              </Paper>
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

    
          </Flex>
        </Box>
      </>
    );
  }
}

export default withStyles(styles)(App);