import QtQuick
import QtQuick.Window

Window {
    id: window
    objectName: "window"
    width: 1280
    height: 720
    minimumWidth: 960
    minimumHeight: 540
    visible: true
    title: "WinVaders"
    color: "black"

    property string screen: "menu"
    property var settings: Storage.settings()
    onSettingsChanged: {
        Sound.setEnabled(settings.sound)
        Music.setEnabled(settings.music)
    }
    property var pendingSave: null
    property int finalScore: 0
    property int finalLevel: 1
    property int highlightRank: -1

    Theme { id: theme }

    function setSetting(key, value) {
        Storage.setSetting(key, value)
        settings = Storage.settings()
    }

    function toggleFullscreen() {
        const full = window.visibility !== Window.FullScreen
        if (full) window.showFullScreen()
        else window.showNormal()
        setSetting("fullscreen", full)
    }

    function startGame(save) {
        pendingSave = save
        screen = "game"
    }

    onScreenChanged: {
        if (screen !== "game") Music.play("menu")
        if (screen === "menu") menu.refresh()
        else if (screen === "scores") scores.refresh()
        else if (screen === "name") nameEntry.reset()
    }

    Component.onCompleted: {
        Sound.setEnabled(settings.sound)
        Music.setEnabled(settings.music)
        Music.play("menu")
        if (settings.fullscreen) window.showFullScreen()
    }

    Shortcut {
        sequences: ["F11", "F"]
        enabled: window.screen !== "name"
        onActivated: window.toggleFullscreen()
    }

    Shortcut {
        sequences: ["N"]
        enabled: window.screen !== "name"
        onActivated: window.setSetting("music", !window.settings.music)
    }

    Item {
        id: stage
        objectName: "stage"
        width: 1280
        height: 720
        anchors.centerIn: parent
        scale: Math.min(window.width / 1280, window.height / 720)
        clip: true

        Rectangle { anchors.fill: parent; color: theme.bg }

        Menu {
            id: menu
            objectName: "menu"
            anchors.fill: parent
            theme: theme
            visible: window.screen === "menu"
            soundOn: window.settings.sound
            musicOn: window.settings.music
            fullscreen: window.visibility === Window.FullScreen
            onNewGame: window.startGame(null)
            onContinueGame: window.startGame(Storage.loadSave())
            onShowScores: { window.highlightRank = -1; window.screen = "scores" }
            onToggleSound: window.setSetting("sound", !window.settings.sound)
            onToggleMusic: window.setSetting("music", !window.settings.music)
            onToggleFullscreen: window.toggleFullscreen()
            onQuit: Qt.quit()
        }

        HighScores {
            id: scores
            anchors.fill: parent
            theme: theme
            visible: window.screen === "scores"
            highlightRank: window.highlightRank
            onBack: window.screen = "menu"
        }

        NameEntry {
            id: nameEntry
            anchors.fill: parent
            theme: theme
            visible: window.screen === "name"
            score: window.finalScore
            level: window.finalLevel
            defaultName: window.settings.last_name
            onSubmitted: function(name) {
                window.highlightRank = Storage.addScore(name, window.finalScore, window.finalLevel)
                window.setSetting("last_name", name.trim())
                window.screen = "scores"
            }
        }

        Loader {
            id: gameLoader
            anchors.fill: parent
            active: window.screen === "game"
            source: "Game.qml"
            onLoaded: {
                item.theme = theme
                item.soundOn = Qt.binding(() => window.settings.sound)
                item.musicOn = Qt.binding(() => window.settings.music)
                item.forceActiveFocus()
                if (window.pendingSave && window.pendingSave.level) item.resume(window.pendingSave)
                else item.startNew()
            }
        }

        Connections {
            target: gameLoader.item
            ignoreUnknownSignals: true
            function onQuitToMenu() { window.screen = "menu" }
            function onToggleSound() { window.setSetting("sound", !window.settings.sound) }
            function onFinished(score, level) {
                window.finalScore = score
                window.finalLevel = level
                if (Storage.qualifies(score)) {
                    window.screen = "name"
                } else {
                    window.highlightRank = -1
                    window.screen = "scores"
                }
            }
        }
    }
}
