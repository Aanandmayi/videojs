import {
	Grid,
	IconButton,
	makeStyles,
	Slider,
	TextField
} from "@material-ui/core";
import CallEndIcon from "@material-ui/icons/CallEnd";
import ExitToAppIcon from "@material-ui/icons/ExitToApp";
import MicIcon from "@material-ui/icons/Mic";
import MicOffIcon from "@material-ui/icons/MicOff";
import ScreenShareIcon from "@material-ui/icons/ScreenShare";
import SendIcon from "@material-ui/icons/Send";
import StopScreenShareIcon from "@material-ui/icons/StopScreenShare";
import VideocamIcon from "@material-ui/icons/Videocam";
import VideocamOffIcon from "@material-ui/icons/VideocamOff";
import AgoraRTC from "agora-rtc-sdk-ng";
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../firebase";
import { useStateValue } from "../../StateProvider";
import RtmClient from "../../utils/rtm-client";
import Chat from "./Chat";

const useStyles = makeStyles((theme) => ({
	fullHeight: {
		minHeight: "inherit",
	},
	icons: {
		position: "absolute",
		zIndex: "1",
		padding: "10px",
	},
	leave: { background: "red", "&:hover": { background: "red" } },
	box: {
		position: "absolute",
		top: "150px",
		zIndex: "1",
		background: "#fff",
		borderRadius: "3px",
		margin: "10px",
		"& div": {
			border: "1px solid #999",
			width: "180px !important",
			height: "180px !important",
		},
	},
	teacherIcons: {
		position: "absolute",
		zIndex: "1",
		right: "0",
	},
	slider: {
		width: "50px",
		alignSelf: "center",
		margin: "12px",
	},
	bigVideo: {
		height: "100%",
		borderRight: "1px solid black",
		borderTop: "1px solid black",
		borderBottom: "1px solid black",
		borderRadius: "5px",
		overflowY: "hidden",
		"& video": {
			objectFit: "contain !important",
		},
	},
	miniVideo: {
		height: "30%",
		borderTop: "1px solid black",
		borderLeft: "1px solid black",
		borderRadius: "5px",
		overflow: "hidden",
	},
	chatWindow: {
		height: "70%",
		display: "flex",
		flexDirection: "column",
	},
	chat: {
		marginTop: "10px",
		padding: "0 10px",
	},
}));

const Style = {
	base: [
		"color: #fff",
		"background-color: #444",
		"padding: 2px 4px",
		"border-radius: 2px",
	],
	warning: ["color: #eee", "background-color: red"],
	success: ["background-color: green"],
};
const log = (text, extra = []) => {
	let style = Style.base.join(";") + ";";
	style += extra.join(";"); // Add any additional styles
	console.log(`%c${JSON.stringify(text)}`, style);
};

const TeacherMeetingPage = () => {
	AgoraRTC.setLogLevel(4);
	const classes = useStyles();
	const params = useParams();
	const history = useHistory();
	const bigVideoRef = useRef(null);
	const miniVideoRef = useRef(null);
	const client = useRef();
	const rtm = useRef(new RtmClient());
	const localTracks = useRef();
	const screenLocalTracks = useRef();
	const screenClient = useRef();
	const remoteUsers = useRef();
	const options = useRef();
	const [videoTrackEnabled, setVideoTrackEnabled] = useState(true);
	const [audioTrackEnabled, setAudioTrackEnabled] = useState(true);
	const [volume, setVolume] = useState(0);
	const [tabIndex, setTabIndex] = useState(0);
	const [msg, setMsg] = useState("");
	const [screenShared, setScreenShared] = useState(false);
	const [doubtMsgs, setDoubtMsgs] = useState([]);
	const [publicMsgs, setPublicMsgs] = useState([]);
	const [doubtVisible, setDoubtVisible] = useState(false);
	const [doubtUser, setDoubtUser] = useState("");
	const [presentUsers, setPresentUsers] = useState({});
	const [callID, setCallID] = useState("");
	const [{ user }] = useStateValue();
	const meetingId = localStorage.getItem("meetingId");
	const channelName = localStorage.getItem("channelName");
	const teacherToken = localStorage.getItem("teacherToken");
	const screenToken = localStorage.getItem("screenToken");
	const teacherMeetingRef = db
		.collection("meetings")
		.doc(params.sub)
		.collection(user?.id)
		.doc(meetingId);

	const userData = {
		name: user?.name,
		role: "host",
		token: teacherToken,
		chatId: `${user?.id}__${user?.name}`,
	};

	const appID = "";

	const joinMeeting = async () => {
		// log("JOINING", Style.success);
		// create Agora client
		client.current.setClientRole(options.current.role);

		// if (options.current.role === "audience") {
		// add event listener to play remote tracks when remote user publishs.
		client.current.on("user-published", handleUserPublished);
		client.current.on("user-unpublished", handleUserUnpublished);
		// }

		// join the channel
		options.current.uid = await client.current.join(
			options.current.appid,
			options.current.channel,
			options.current.token || null,
			options.current.uid || null
		);

		if (options.current.role === "host") {
			await AgoraRTC.createMicrophoneAndCameraTracks()
				.then(([videoTracks, audioTracks]) => {
					localTracks.current.videoTrack = audioTracks;
					localTracks.current.audioTrack = videoTracks;
				})
				.catch((e) => {
					log("USER DENIED MEDIA PERMISSIONS" + e, Style.success);
					window.alert(
						"Please give permission for the camera and microphone use"
					);
				});

			if (
				localTracks.current.audioTrack &&
				localTracks.current.videoTrack
			) {
				if (localTracks.current.audioTrack) {
					// log("live with audio", Style.success);
					await localTracks.current.audioTrack.setEnabled(
						audioTrackEnabled
					);

					setInterval(function () {
						var audioLevel =
							localTracks.current.audioTrack?.getVolumeLevel();
						setVolume(audioLevel);
					}, 100);
				}

				if (localTracks.current.videoTrack) {
					// log("live with video", Style.success);
					localTracks.current.videoTrack.play(
						document.querySelector("#miniVideo")
					);
					await localTracks.current.videoTrack.setEnabled(
						videoTrackEnabled
					);
				}

				// publish local tracks to channel
				await client.current
					.publish(Object.values(localTracks.current))
					.then(() => {
						log("PUBLISH SUCCESS HOST IS NOW LIVE", Style.success);
						// TODO - MAKE THE LIVE BUTTON GREEN
					})
					.catch(() => {
						log("PUBLISH FAILED", Style.success);
						//TODO -show snack bar to retry or rejoin
					});
			} else {
				log("USER DENIED MEDIA PERMISSIONS", Style.success);
			}
		}
	};
	const handleAudio = async () => {
		if (!localTracks.current.audioTrack) return;
		await localTracks.current.audioTrack.setEnabled(!audioTrackEnabled);
		setAudioTrackEnabled(!audioTrackEnabled);
	};

	const handleVideo = async () => {
		if (!localTracks.current.videoTrack) return;
		await localTracks.current.videoTrack.setEnabled(!videoTrackEnabled);
		setVideoTrackEnabled(!videoTrackEnabled);
	};

	const subscribe = async (user, mediaType) => {
		// subscribe to a remote user

		await client.current.subscribe(user, mediaType);

		// log("subscribe success", Style.success);

		if (mediaType === "audio") {
			user.audioTrack.play();
		}
		return user;
	};

	const handleUserPublished = async (user, mediaType) => {
		const id = user.uid;
		let updatedUser = await subscribe(user, mediaType);
		remoteUsers.current[id] = updatedUser;
		let hasScreen = Object.entries(remoteUsers.current)
			.map((remoteUser) => remoteUser[0].includes("_screen"))
			.includes(true);
		let hasDoubt = Object.entries(remoteUsers.current)
			.map((remoteUser) => remoteUser[0].includes("_doubt"))
			.includes(true);
		setDoubtVisible(hasDoubt);

		Object.entries(remoteUsers.current).forEach((remoteUser) => {
			if (remoteUser[0].includes("_screen")) {
				remoteUser[1].videoTrack?.play(
					document.querySelector("#bigVideo")
				);
			} else if (remoteUser[0].includes("_doubt")) {
				remoteUser[1].videoTrack?.play(
					document.querySelector("#doubtVideo")
				);
			} else {
				if (hasScreen || hasDoubt)
					remoteUser[1].videoTrack?.play(
						document.querySelector("#bigVideo")
					);
				else
					remoteUser[1].videoTrack?.play(
						document.querySelector("#miniVideo")
					);
			}
		});
	};

	function handleUserUnpublished(user) {
		const id = user.uid;
		delete remoteUsers.current[id];
		let hasScreen = Object.entries(remoteUsers.current)
			.map((remoteUser) => remoteUser[0].includes("_screen"))
			.includes(true);
		let hasDoubt = Object.entries(remoteUsers.current)
			.map((remoteUser) => remoteUser[0].includes("_doubt"))
			.includes(true);
		setDoubtVisible(hasDoubt);

		Object.entries(remoteUsers.current).forEach((remoteUser) => {
			if (remoteUser[0].includes("_screen")) {
				remoteUser[1].videoTrack?.play(
					document.querySelector("#bigVideo")
				);
			} else if (remoteUser[0].includes("_doubt")) {
				remoteUser[1].videoTrack?.play(
					document.querySelector("#doubtVideo")
				);
			} else {
				if (hasScreen || hasDoubt)
					remoteUser[1].videoTrack?.play(
						document.querySelector("#bigVideo")
					);
				else
					remoteUser[1].videoTrack?.play(
						document.querySelector("#miniVideo")
					);
			}
		});
	}

	async function leaveMeeting() {
		try {
			for (let trackName in localTracks.current) {
				let track = localTracks.current[trackName];
				if (track) {
					track.stop();
					track.close();
					localTracks.current[trackName] = null;
				}
			}
			for (let trackName in screenLocalTracks.current) {
				let track = screenLocalTracks.current[trackName];
				if (track) {
					track.stop();
					track.close();
					screenLocalTracks.current[trackName] = null;
				}
			}
			await client.current.leave();

			fetch(`${process.env.REACT_APP_API}/meeting/updateMeeting`, {
				method: "POST",
				body: JSON.stringify({
					subjectId: params.sub,
					meetingId,
					channelName,
					userId: user?.id,
					status: "ended",
				}),
				headers: {
					"content-type": "application/json",
				},
			});
		} catch (err) {
			console.error(err);
		}
		// log("Client leaves channel success", Style.success);
		history.push(`/${params.sub}/meetings`);
	}

	/* =============================================== Share Screen ===============================================*/
	const shareScreen = async () => {
		screenClient.current = AgoraRTC.createClient({
			mode: "rtc",
			codec: "vp8",
		});

		await screenClient.current.join(
			appID,
			channelName,
			screenToken,
			`${user?.id}_screen` || null
		);

		// ** create local tracks, using microphone and screen
		const screenTrack = await AgoraRTC.createScreenVideoTrack();

		screenTrack.play(document.querySelector("#bigVideo"));

		await screenClient.current.publish(screenTrack);
		// log("screen share publish success", Style.success);
		setScreenShared(true);
	};

	const stopShareScreen = async () => {
		document.querySelector("#bigVideo").querySelector("div").remove();
		await screenClient.current.leave();
		setScreenShared(false);
	};

	/* =============================================== Chatting ===============================================*/

	/* =============================================== Msg Events ===============================================*/

	rtm.current.on("ConnectionStateChanged", (newState, reason) => {
		// console.log("reason", reason);
		// const view = $("<div/>", {
		// 	text: ["newState: " + newState, ", reason: ", reason].join(""),
		// });
		// $("#log").append(view);
		if (newState === "ABORTED") {
			if (reason === "REMOTE_LOGIN") {
				// toast.error("You have already been kicked off!");
				// 		$("#accountName").text("Agora Chatroom");
				// 		$("#dialogue-list")[0].innerHTML = "";
				// 		$("#chat-message")[0].innerHTML = "";
			}
		}
	});

	rtm.current.on("MessageFromPeer", async (message, peerId) => {
		setDoubtMsgs([
			...doubtMsgs,
			{ msg: message.text, peerId: peerId.split("__")[1] },
		]);
	});

	rtm.current.on("MemberJoined", async ({ channelName, args }) => {
		// eslint-disable-next-line no-unused-vars
		setPublicMsgs([
			...publicMsgs,
			{
				msg: `${args[0].split("__")[1]} Joined`,
				log: true,
			},
		]);
		setPresentUsers({});
		rtm.current.channels[channelName].channel
			.getMembers()
			.then((members) => {
				let users = {};
				members.forEach(async (member) => {
					let memberId = member.split("__")[0];
					let memberName = member.split("__")[1];
					teacherMeetingRef
						.collection("attendance")
						.doc(memberId)
						.set({
							name: memberName,
						});
					users[member] = false;
				});
				setPresentUsers({ ...users });
			});
		// toast.success(`${memberId} joined ${channelName}`);
	});

	rtm.current.on("MemberLeft", ({ channelName, args }) => {
		// eslint-disable-next-line no-unused-vars
		setPublicMsgs([
			...publicMsgs,
			{
				msg: `${args[0].split("__")[1]} Left`,
				log: true,
			},
		]);
		setPresentUsers({});
		rtm.current.channels[channelName].channel
			.getMembers()
			.then((members) => {
				let users = {};
				members.forEach((member) => {
					// let memberId = member.split("__")[0];
					// teacherMeetingRef
					// 	.collection("liveAttendance")
					// 	.doc(memberId)
					// 	.delete();
					users[member] = false;
				});
				setPresentUsers({ ...users });
			});
		// toast.info(`${memberId} left ${channelName}`);
	});

	rtm.current.on("ChannelMessage", async ({ channelName, args }) => {
		const [message, memberId] = args;
		setPublicMsgs([
			...publicMsgs,
			{ msg: message.text, peerId: memberId.split("__")[1] },
		]);
	});

	rtm.current.on("RemoteInvitationReceived", (remoteInvitation) => {
		if (remoteInvitation.callerId in presentUsers) {
			presentUsers[remoteInvitation.callerId] = true;
		}
		setPublicMsgs([
			...publicMsgs,
			{
				msg: `${remoteInvitation.callerId.split("__")[1]} Raised hand`,
				log: true,
			},
		]);
	});

	rtm.current.on("RemoteInvitationAccepted", () => {
		// toast.success("RemoteInvitationAccepted")
	});

	rtm.current.on("RemoteInvitationRefused", () => {
		// toast.error("RemoteInvitationRefused");
	});

	useEffect(() => {
		if (callID !== "") {
			if (callID.slice(0, -7) in presentUsers) {
				presentUsers[callID.slice(0, -7)] = false;
			}
			try {
				if (callID.includes("Accept")) {
					if (doubtVisible) {
						rtm.current.refuseCall(callID.slice(0, -7));
					} else {
						rtm.current.acceptCall(callID.slice(0, -7));
						setDoubtUser(callID.slice(0, -7));
					}
				}
				if (callID.includes("Reject")) {
					rtm.current.refuseCall(callID.slice(0, -7));
					setDoubtUser(callID.slice(0, -7));
				}
			} catch (e) {
				console.log(e);
			}
			setCallID("");
		}
	}, [callID, presentUsers, doubtVisible]);
	/* =============================================== Msg Handling ===============================================*/

	const joinMsgChannel = () => {
		if (!rtm.current._logined) {
			// toast.error("Please Login First");
			return;
		}

		if (
			rtm.current.channels[channelName] ||
			(rtm.current.channels[channelName] &&
				rtm.current.channels[channelName].joined)
		) {
			// toast.error("You already joined");
			return;
		}

		rtm.current
			.joinChannel(channelName)
			.then(() => {
				toast.success("Channel Joined");
				rtm.current.channels[channelName].joined = true;
				rtm.current.channels[channelName].channel
					.getMembers()
					.then((members) => {
						// log("Joining", Style.success);
						let users = {};
						setPresentUsers([]);
						members.forEach((member) => {
							let memberId = member.split("__")[0];
							let memberName = member.split("__")[1];
							teacherMeetingRef
								.collection("attendance")
								.doc(memberId)
								.set({
									name: memberName,
								});
							users[member] = false;
						});
						setPresentUsers({ ...users });
					});
			})
			.catch((err) => {
				// toast.error(
				// 	"Join channel failed, please open console see more details."
				// );
				console.error(err);
			});
	};

	const sendToChannel = (e) => {
		e.preventDefault();
		if (!rtm.current._logined) {
			// toast.error("Please Login First");
			return;
		}

		if (
			!rtm.current.channels[channelName] ||
			(rtm.current.channels[channelName] &&
				!rtm.current.channels[channelName].joined)
		) {
			// toast.error("No Channel Joined!! Joining Now!");
			joinMsgChannel();
		}

		rtm.current
			.sendChannelMessage(msg, channelName)
			.then(() => {
				setPublicMsgs([
					...publicMsgs,
					{ msg, peerId: userData.chatId.split("__")[1] },
				]);
			})
			.catch((err) => {
				// toast.error(
				// 	"Send message to channel " +
				// 		channelName +
				// 		" failed, please open console see more details."
				// );
				console.error(err);
			});
		setMsg("");
	};

	const kick = () => {
		rtm.current
			.sendPeerMessage("End Doubt", doubtUser)
			.then(() => {
				// log("Ending Doubt", Style.warning);
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/* =============================================== Init ===============================================*/

	useEffect(() => {
		client.current = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
		localTracks.current = {
			videoTrack: null,
			audioTrack: null,
		};
		screenLocalTracks.current = {
			videoTrack: null,
		};

		remoteUsers.current = {};

		// Agora client options
		options.current = {
			appid: appID,
			channel: channelName,
			uid: user?.id,
			token: userData.token,
			role: userData.role, // host or audience
		};

		joinMeeting();

		if (rtm.current._logined) {
			// toast.error("You already logined");
			return;
		}
		fetch(`${process.env.REACT_APP_API}/token/getMessagingAccessToken`, {
			method: "POST",
			body: JSON.stringify({ uid: userData.chatId }),
			headers: {
				"content-type": "application/json",
			},
		})
			.then((resp) => resp.json())
			.then((data) => {
				userData["userToken"] = data.messagingToken;
				try {
					rtm.current.init(appID);
					window.rtm = rtm.current;
					rtm.current
						.login(userData.chatId, userData.userToken)
						.then(() => {
							rtm.current._logined = true;
							rtm.current.status = "onLine";
							toast.info(
								`Login: ${userData.chatId.split("__")[1]}`
							);
							joinMsgChannel();
						})
						.catch((err) => {
							console.log(err);
						});
				} catch (err) {
					// toast.error(
					// 	"Login failed, please open console see more details"
					// );
					console.error(err);
				}
			});
		fetch(`${process.env.REACT_APP_API}/meeting/updateMeeting`, {
			method: "POST",
			body: JSON.stringify({
				subjectId: params.sub,
				meetingId,
				channelName,
				userId: user?.id,
				status: "live",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			<Grid container className={classes.fullHeight}>
				<Grid item xs={9}>
					<div
						id='bigVideo'
						ref={bigVideoRef}
						className={classes.bigVideo}
					>
						<Grid
							container
							component='span'
							className={classes.icons}
						>
							<Grid item component='span'>
								<IconButton
									className={classes.leave}
									onClick={leaveMeeting}
								>
									<CallEndIcon style={{ color: "#fff" }} />
								</IconButton>
							</Grid>
							<Grid
								item
								component='span'
								className={classes.slider}
							>
								<Slider
									disabled
									value={volume * 100}
									aria-labelledby='disabled-slider'
								/>
							</Grid>
						</Grid>
						{doubtVisible && (
							<div className={classes.box} id='doubtVideo'>
								<Grid
									component='span'
									direction='column'
									className={classes.teacherIcons}
								>
									<Grid item component='span'>
										<IconButton onClick={kick}>
											<ExitToAppIcon
												style={{ color: "#fff" }}
											/>
										</IconButton>
									</Grid>
								</Grid>
							</div>
						)}
					</div>
				</Grid>
				<Grid item xs={3}>
					<div
						ref={miniVideoRef}
						id='miniVideo'
						className={classes.miniVideo}
					>
						<Grid className={classes.teacherIcons}>
							<Grid item>
								<IconButton
									color='primary'
									onClick={handleAudio}
								>
									{audioTrackEnabled ? (
										<MicIcon />
									) : (
										<MicOffIcon />
									)}
								</IconButton>
							</Grid>
							<Grid item>
								<IconButton
									color='primary'
									onClick={handleVideo}
								>
									{videoTrackEnabled ? (
										<VideocamIcon />
									) : (
										<VideocamOffIcon />
									)}
								</IconButton>
							</Grid>
							<Grid item>
								<IconButton
									color='primary'
									onClick={() => {
										screenShared
											? stopShareScreen()
											: shareScreen();
									}}
								>
									{screenShared ? (
										<StopScreenShareIcon />
									) : (
										<ScreenShareIcon />
									)}
								</IconButton>
							</Grid>
						</Grid>
					</div>
					<div className={classes.chatWindow}>
						<Chat
							// privateMsgs={privateMsgs}
							doubtMsgs={doubtMsgs}
							publicMsgs={publicMsgs}
							presentUsers={presentUsers}
							setCallID={setCallID}
							setTabIndex={setTabIndex}
						/>
						{tabIndex === 0 && (
							<Grid
								container
								alignItems='center'
								className={classes.chat}
							>
								<Grid item xs={10}>
									<form
										onSubmit={(e) =>
											msg !== "" && sendToChannel(e)
										}
									>
										<TextField
											variant='outlined'
											fullWidth
											value={msg}
											onChange={(e) =>
												setMsg(e.target.value)
											}
										/>
									</form>
								</Grid>
								<Grid item xs={2}>
									<IconButton
										color='primary'
										onClick={() =>
											msg !== "" && sendToChannel()
										}
									>
										<SendIcon />
									</IconButton>
								</Grid>
							</Grid>
						)}
					</div>
				</Grid>
			</Grid>
		</>
	);
};

export default TeacherMeetingPage;
