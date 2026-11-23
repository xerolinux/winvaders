import QtQuick
import "sprites.mjs" as Sprites
import "logic.mjs" as Logic

FocusScope {
    id: root

    property var theme
    property bool soundOn: true
    property bool musicOn: true
    property bool fullscreen: false
    property int current: 0
    property var entries: []

    signal newGame()
    signal continueGame()
    signal showScores()
    signal toggleSound()
    signal toggleMusic()
    signal toggleFullscreen()
    signal quit()

    function refresh() {
        const list = [{ id: "new", label: "NEW GAME" }]
        if (Storage.hasSave()) list.unshift({ id: "continue", label: "CONTINUE" })
        list.push({ id: "scores", label: "HIGH SCORES" })
        list.push({ id: "sound", label: "SOUND: " + (soundOn ? "ON" : "OFF") })
        list.push({ id: "music", label: "MUSIC: " + (musicOn ? "ON" : "OFF") })
        list.push({ id: "fullscreen", label: "FULLSCREEN: " + (fullscreen ? "ON" : "OFF") })
        const update = { available: "UPDATE TO v" + Updater.latest, downloading: "DOWNLOADING UPDATE...",
                         failed: "UPDATE FAILED - RETRY" }[Updater.state]
        if (update) list.unshift({ id: "update", label: update })
        if (Storage.canAddDesktopShortcut() && !Storage.hasDesktopShortcut()) list.push({ id: "shortcut", label: "ADD DESKTOP SHORTCUT" })
        list.push({ id: "quit", label: "QUIT" })
        entries = list
        current = Math.min(current, list.length - 1)
        forceActiveFocus()
    }

    function activate(index) {
        switch (entries[index].id) {
        case "update": Updater.install(); break
        case "continue": continueGame(); break
        case "new": newGame(); break
        case "scores": showScores(); break
        case "sound": toggleSound(); break
        case "music": toggleMusic(); break
        case "fullscreen": toggleFullscreen(); break
        case "shortcut": Storage.addDesktopShortcut(); refresh(); break
        case "quit": quit(); break
        }
    }

    onSoundOnChanged: refresh()
    onMusicOnChanged: refresh()
    onFullscreenChanged: refresh()
    onVisibleChanged: if (visible) refresh()

    Connections {
        target: Updater
        enabled: root.visible
        function onStateChanged() { root.refresh() }
    }
    Component.onCompleted: refresh()

    Keys.onPressed: function(event) {
        const k = event.key
        if (k === Qt.Key_Up) current = (current + entries.length - 1) % entries.length
        else if (k === Qt.Key_Down) current = (current + 1) % entries.length
        else if (k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) {
            if (!event.isAutoRepeat) activate(current)
        } else if (k === Qt.Key_Escape) {
            if (!event.isAutoRepeat) quit()
        } else return
        event.accepted = true
    }

    property var drifters: []
    property int tick: 0

    function seedDrifters() {
        const types = Object.keys(Logic.ROSTER)
        const arr = []
        for (let i = 0; i < 18; i++)
            arr.push({ type: types[i % types.length], x: Math.random() * 1280, y: Math.random() * 720,
                       vx: (Math.random() - 0.5) * 0.8, vy: 0.2 + Math.random() * 0.5 })
        drifters = arr
    }

    Timer {
        interval: 33
        repeat: true
        running: root.visible
        onTriggered: {
            root.tick++
            for (const d of root.drifters) {
                d.x += d.vx
                d.y += d.vy
                if (d.y > 740) { d.y = -40; d.x = Math.random() * 1280 }
                if (d.x < -50) d.x = 1290
                if (d.x > 1290) d.x = -50
            }
            backdrop.requestPaint()
        }
    }

    Canvas {
        id: backdrop
        anchors.fill: parent
        Component.onCompleted: root.seedDrifters()
        onPaint: {
            const ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)
            ctx.globalAlpha = 0.28
            for (const d of root.drifters) Sprites.drawAlien(ctx, d.type, d.x, d.y, 40, 30, 0, 0)
            ctx.globalAlpha = 1
        }
    }

    Column {
        anchors.horizontalCenter: parent.horizontalCenter
        y: 50
        spacing: 8

        Row {
            anchors.horizontalCenter: parent.horizontalCenter
            Repeater {
                model: "WINVADERS".split("")
                Text {
                    required property string modelData
                    required property int index
                    text: modelData
                    font.family: root.theme.font
                    font.pixelSize: 76
                    font.bold: true
                    color: root.theme.rainbow[index % root.theme.rainbow.length]
                    y: Math.sin((root.tick + index * 6) / 10) * 6
                }
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Defend Linux from the invading Microsoft apps"
            font.family: root.theme.font
            font.pixelSize: 20
            color: root.theme.muted
        }

        Item { width: 1; height: 18 }

        Repeater {
            model: root.entries
            Rectangle {
                required property var modelData
                required property int index
                readonly property bool selected: index === root.current
                anchors.horizontalCenter: parent.horizontalCenter
                width: 460
                height: 42
                radius: 6
                color: selected ? Qt.rgba(0.22, 1, 0.56, 0.14) : "transparent"
                border.color: selected ? root.theme.green : "transparent"
                border.width: 2

                Text {
                    anchors.centerIn: parent
                    text: (parent.selected ? "> " : "") + parent.modelData.label + (parent.selected ? " <" : "")
                    font.family: root.theme.font
                    font.pixelSize: 24
                    font.bold: true
                    color: parent.selected ? root.theme.green : root.theme.text
                }

                MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    onEntered: root.current = parent.index
                    onClicked: root.activate(parent.index)
                }
            }
        }
    }

    Text {
        objectName: "credit"
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 16
        text: "Inspired by: <b>RandyPinball</b>"
        textFormat: Text.StyledText
        font.family: root.theme.font
        font.pixelSize: 18
        color: root.theme.yellow
    }

    Text {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 48
        text: "Arrows/Enter to choose  -  F11 fullscreen  -  in game: Left/Right move, Space fire, Esc pause, M sound, N music"
        font.family: root.theme.font
        font.pixelSize: 15
        color: root.theme.muted
    }
}
