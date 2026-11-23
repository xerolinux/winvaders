import QtQuick

FocusScope {
    id: root

    property var theme
    property int score: 0
    property int level: 1
    property string defaultName: ""
    property bool armed: false

    signal submitted(string name)

    readonly property string letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    function setName(text) {
        input.text = text
        input.cursorPosition = text.length
    }

    function cycleLetter(step) {
        const t = input.text
        if (t === "") {
            setName("A")
            return
        }
        const i = letters.indexOf(t[t.length - 1].toUpperCase())
        const next = letters[(i + step + letters.length) % letters.length]
        setName(t.slice(0, -1) + next)
    }

    function reset() {
        armed = false
        input.text = defaultName
        input.selectAll()
        input.forceActiveFocus()
    }

    Column {
        anchors.centerIn: parent
        spacing: 22

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "NEW HIGH SCORE!"
            font.family: root.theme.font
            font.pixelSize: 60
            font.bold: true
            color: root.theme.yellow
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.score + " points  -  level " + root.level
            font.family: root.theme.font
            font.pixelSize: 26
            color: root.theme.text
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Enter your name:"
            font.family: root.theme.font
            font.pixelSize: 22
            color: root.theme.muted
        }

        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: 420
            height: 64
            radius: 6
            color: "transparent"
            border.color: root.theme.green
            border.width: 2

            TextInput {
                id: input
                objectName: "nameInput"
                anchors.fill: parent
                anchors.margins: 10
                horizontalAlignment: TextInput.AlignHCenter
                verticalAlignment: TextInput.AlignVCenter
                maximumLength: 12
                font.family: root.theme.font
                font.pixelSize: 32
                font.bold: true
                color: root.theme.green
                selectionColor: root.theme.purple
                cursorVisible: activeFocus
                onAccepted: root.submitted(text)
                // Swallow keys still auto-repeating from the game until a fresh press.
                Keys.onPressed: function(event) {
                    if (!root.armed) {
                        if (event.isAutoRepeat) {
                            event.accepted = true
                            return
                        }
                        root.armed = true
                    }
                    const k = event.key
                    if (k === Qt.Key_Up || k === Qt.Key_Down) root.cycleLetter(k === Qt.Key_Up ? 1 : -1)
                    else if (k === Qt.Key_Right) root.setName(input.text + (input.text.length < input.maximumLength ? "A" : ""))
                    else if (k === Qt.Key_Left) root.setName(input.text.slice(0, -1))
                    else return
                    event.accepted = true
                }
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Enter or A to save  -  pad: Up/Down letter, Right add, Left delete"
            font.family: root.theme.font
            font.pixelSize: 18
            color: root.theme.muted
        }
    }
}
