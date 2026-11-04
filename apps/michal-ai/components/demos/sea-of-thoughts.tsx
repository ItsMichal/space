import { CodeDemo } from './code-demo'

// Sea of Thoughts' server, from ItsMichal/sea-of-thoughts app.js: an excerpt (the disconnect handler left out), every line as written.
const LINES = [
  'io.on(\'connection\', (socket) => {',
  '',
  '    usersConnected++;',
  '    io.emit(\'users\', "There are " + usersConnected + " thinkers at the Sea of Thoughts.");',
  '',
  '    //When someone sends a Bottle',
  '    socket.on(\'outgoingBottle\', (bottle) =>{',
  '        console.log(\'Bottle: \' + bottle.senders + " - " + bottle.message);',
  '        socket.broadcast.emit(\'incomingBottle\', bottle);',
  '    });',
  '',
  '});',
]

export default function SeaOfThoughts() {
  return <CodeDemo file="app.js" lines={LINES} />
}
