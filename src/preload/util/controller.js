/*
a module for VacuumTube that handles integrating controllers with ui easily, supporting steam input and stuff

controller keycodes are the same as what you'll typically find, but there are custom ones for the axes to be read as directional inputs:
1011: left stick left
1012: left stick up
1013: left stick right
1014: left stick down

1015: right stick left
1016: right stick up
1017: right stick right
1018: right stick down
*/

const { ipcRenderer } = require('electron')
const { EventEmitter } = require('tseep/lib/ee-safe') //youtube doesn't like eval

const emitter = new EventEmitter()

const buttonRepeatInterval = 100;
const buttonRepeatDelay = 500;

const pressedButtons = {}
let buttonRepeatTimeout;
let hasPressedButton = false;

let focused = true;

ipcRenderer.on('focus', () => {
    focused = true;
})

ipcRenderer.on('blur', () => {
    focused = false;
})

const loggedGamepads = {}
requestAnimationFrame(pollGamepads)

function pollGamepads() {
    const gamepads = navigator.getGamepads()
    for (let index in pressedButtons) {
        if (!gamepads[index]) {
            pressedButtons[index] = null;
            delete loggedGamepads[index];
        }
    }

    const steamInput = gamepads.find(g => g && g.id.endsWith('(STANDARD GAMEPAD Vendor: 28de Product: 11ff)'))
    if (steamInput) { //the one true controller here
        if (!loggedGamepads[steamInput.index]) {
            console.log(`[Gamepad] Steam controller connected: index=${steamInput.index}, id="${steamInput.id}", mapping="${steamInput.mapping}", buttons=${steamInput.buttons.length}, axes=${steamInput.axes.length}`);
            loggedGamepads[steamInput.index] = true;
        }
        handleGamepad(steamInput)
    } else {
        for (let gamepad of gamepads) {
            if (gamepad && gamepad.connected) {
                if (!loggedGamepads[gamepad.index]) {
                    console.log(`[Gamepad] Gamepad connected: index=${gamepad.index}, id="${gamepad.id}", mapping="${gamepad.mapping}", buttons=${gamepad.buttons.length}, axes=${gamepad.axes.length}`);
                    loggedGamepads[gamepad.index] = true;
                }
                handleGamepad(gamepad)
            }
        }
    }

    requestAnimationFrame(pollGamepads)
}

function handleGamepad(gamepad) {
    const index = gamepad.index;
    if (!pressedButtons[index]) pressedButtons[index] = {}

    for (let i = 0; i < gamepad.buttons.length; i++) {
        let code = i;

        let button = gamepad.buttons[i]
        let buttonWasPressed = pressedButtons[index][i]

        if (button.pressed && !buttonWasPressed) {
            console.log(`[Gamepad] Gamepad index=${index} button ${i} PRESSED (value=${button.value})`);
            hasPressedButton = true;
            pressedButtons[index][i] = true;
            buttonDown(code)
            stopKeyRepeat()
            buttonRepeatTimeout = setTimeout(() => startButtonRepeat(code), buttonRepeatDelay)
        } else if (!button.pressed && buttonWasPressed) {
            console.log(`[Gamepad] Gamepad index=${index} button ${i} RELEASED`);
            pressedButtons[index][i] = false;
            buttonUp(code)
            stopKeyRepeat()
        }
    }

    for (let i = 0; i < gamepad.axes.length; i++) {
        let axisValue = gamepad.axes[i]
        let axisIndex = i + gamepad.buttons.length; //this is kind of hacky but its fine
        let axisWasPressed = pressedButtons[index][axisIndex]

        let code = null;

        if (i === 0 || (gamepad.mapping !== 'standard' && i === 4)) { //left stick X or non-standard D-pad X
            if (axisValue > 0.5) {
                code = 1013; //right
            } else if (axisValue < -0.5) {
                code = 1011; //left
            }
        } else if (i === 1 || (gamepad.mapping !== 'standard' && i === 5)) { //left stick Y or non-standard D-pad Y
            if (axisValue > 0.5) {
                code = 1014; //down
            } else if (axisValue < -0.5) {
                code = 1012; //up
            }
        } else if (i === 2) { // right stick X (non-standard usually has it here) or standard right X
            if (axisValue > 0.5) {
                code = 1017; //right
            } else if (axisValue < -0.5) {
                code = 1015; //left
            }
        } else if (i === 3) { // right stick Y (standard or non-standard)
            if (axisValue > 0.5) {
                code = 1018; //down
            } else if (axisValue < -0.5) {
                code = 1016; //up
            }
        }

        if (code) {
            if (!axisWasPressed) {
                console.log(`[Gamepad] Gamepad index=${index} axis ${i} MOVED to ${axisValue} -> virtual key ${code}`);
                hasPressedButton = true;
                pressedButtons[index][axisIndex] = true;
                buttonDown(code)
                stopKeyRepeat()
                buttonRepeatTimeout = setTimeout(() => startButtonRepeat(code), buttonRepeatDelay)
            }
        } else {
            if (axisWasPressed) {
                console.log(`[Gamepad] Gamepad index=${index} axis ${i} RELEASED`);
                pressedButtons[index][axisIndex] = false;
                buttonUp(code)
                stopKeyRepeat()
            }
        }
    }
}

function buttonDown(code) {
    if (!focused) return;
    emitter.emit('down', { code })
}

function buttonUp(code) {
    if (!focused) return;
    emitter.emit('up', { code })
}

function startButtonRepeat(code) {
    clearInterval(buttonRepeatTimeout)
    clearTimeout(buttonRepeatTimeout)
    buttonRepeatTimeout = setInterval(() => buttonDown(code), buttonRepeatInterval)
}

function stopKeyRepeat() {
    clearInterval(buttonRepeatTimeout)
}

module.exports = emitter;