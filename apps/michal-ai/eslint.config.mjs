import { reactConfig } from '@space/config/eslint'

// write/dist: the editor build when ItsMichal/space-content lays its editor over this app (editor/scripts/with-site.sh).
export default [{ ignores: ['write/dist/**'] }, ...reactConfig()]
