/**
 * Checks whether a queue visit matches the requesting doctor's speciality.
 * Routed NAMCO visits match on routingSpeciality; otherwise, match on speciality.
 * @param { { speciality?: string, routingSpeciality?: string, Status?: string } } visit - Queue row
 * @param { string } speciality - Speciality of the doctor requesting the queue
 * @return { boolean }
 */
function matchesEffectiveSpeciality(visit, speciality) {
  if (visit?.routingSpeciality) {
    if (visit?.Status === 'Completed Visit') {
      return visit.routingSpeciality == speciality || visit?.speciality == speciality;
    }
    return visit.routingSpeciality == speciality;
  }
  return visit?.speciality == speciality;
}

module.exports = { matchesEffectiveSpeciality };
