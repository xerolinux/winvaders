import QtQuick

FocusScope {
    id: root

    property var theme
    property int highlightRank: -1
    property var entries: []

    signal back()

    function refresh() {
        entries = Storage.scores()
        forceActiveFocus()
    }

    Keys.onPressed: function(event) {
        const k = event.key
        if (k !== Qt.Key_Escape && k !== Qt.Key_Return && k !== Qt.Key_Enter && k !== Qt.Key_Space) return
        event.accepted = true
        // A key still held from the game over screen must not skip this one.
        if (!event.isAutoRepeat) back()
    }

    MouseArea { anchors.fill: parent; onClicked: root.back() }

    Column {
        anchors.horizontalCenter: parent.horizontalCenter
        y: 70
        spacing: 10

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "HIGH SCORES"
            font.family: root.theme.font
            font.pixelSize: 56
            font.bold: true
            color: root.theme.yellow
        }

        Item { width: 1; height: 20 }

        Row {
            spacing: 0
            Repeater {
                model: [["#", 70], ["NAME", 300], ["SCORE", 220], ["LEVEL", 140], ["DATE", 200]]
                Text {
                    required property var modelData
                    width: modelData[1]
                    text: modelData[0]
                    font.family: root.theme.font
                    font.pixelSize: 20
                    font.bold: true
                    color: root.theme.muted
                }
            }
        }

        Repeater {
            model: root.entries
            Row {
                id: entryRow
                required property var modelData
                required property int index
                readonly property color ink: index === root.highlightRank ? root.theme.green
                                           : root.theme.rainbow[index % root.theme.rainbow.length]
                Repeater {
                    model: [
                        [String(entryRow.index + 1), 70],
                        [entryRow.modelData.name, 300],
                        [String(entryRow.modelData.score), 220],
                        [String(entryRow.modelData.level), 140],
                        [entryRow.modelData.date.slice(0, 10), 200]
                    ]
                    Text {
                        required property var modelData
                        width: modelData[1]
                        text: modelData[0]
                        elide: Text.ElideRight
                        font.family: root.theme.font
                        font.pixelSize: 26
                        font.bold: entryRow.index === root.highlightRank
                        color: entryRow.ink
                    }
                }
            }
        }

        Text {
            visible: root.entries.length === 0
            anchors.horizontalCenter: parent.horizontalCenter
            text: "No scores yet. Go save Linux!"
            font.family: root.theme.font
            font.pixelSize: 24
            color: root.theme.text
        }
    }

    Text {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottomMargin: 24
        text: "Press Enter or Esc to return"
        font.family: root.theme.font
        font.pixelSize: 18
        color: root.theme.muted
    }
}
