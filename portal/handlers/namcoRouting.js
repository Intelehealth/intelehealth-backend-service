/**
 * Checks whether a queue visit matches the requesting doctor's speciality.
 * Routed NAMCO visits match on routingSpeciality; otherwise, match on speciality. Once a
 * routed visit is Completed or Ended, both the NAMCO specialist (routingSpeciality) and the
 * original referring doctor (speciality) should still see it in their own visit lists.
 * Follow-up visits are the exception: a follow-up belongs only to whichever doctor actually
 * provided it, so that dual-visibility never applies there even though a follow-up visit's
 * Status is also 'Completed Visit'.
 * @param { { speciality?: string, routingSpeciality?: string, Status?: string } } visit - Queue row
 * @param { string } speciality - Speciality of the doctor requesting the queue
 * @param { boolean } [isFollowUp] - True when matching against the Follow-Up queue specifically
 * @return { boolean }
 */
function matchesEffectiveSpeciality(visit, speciality, isFollowUp = false) {
  if (visit?.routingSpeciality) {
    if (!isFollowUp && (visit?.Status === 'Completed Visit' || visit?.Status === 'Ended Visit')) {
      return visit.routingSpeciality == speciality || visit?.speciality == speciality;
    }
    return visit.routingSpeciality == speciality;
  }
  return visit?.speciality == speciality;
}

module.exports = { matchesEffectiveSpeciality };
