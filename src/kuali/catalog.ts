import * as cheerio from 'cheerio';

import { Course, KualiCourseItem, KualiCourseItemParsed, NestedPreCoRequisites } from '../types';
import { each } from 'async';

/**
 * Parses the pre and co-reqs from the Kuali data into a usable format.
 *
 * @param preCoReqs HTML from the Kuali attribute
 * @returns parsed pre and co-reqs in JSON format
 */
function parsePreCoReqs(preCoReqs: string): Array<NestedPreCoRequisites | Course | string> {
  const reqs: Array<NestedPreCoRequisites | Course | string> = [];

  const quantityRegex = /(Complete|(?<coreq>Completed or concurrently enrolled in)) *(?<quantity>all|\d)* (of|(?<units>units from))/;
  const earnMinimumRegex = /Earn(ed)? a minimum (?<unit>grade|GPA) of (?<min>[^ ]+) (in (?<quantity>\d+))?/;
  const courseRegex = /(?<subject>\w{2,4})(?<code>\d{3}\w?)/;

  const $ = cheerio.load(preCoReqs);

  // Iterate through each unordered list in the HTML
  $('ul')
    .first()
    .children('li,div')

    .each((_i, el) => {
      const item = $(el);

      const quantityMatch = quantityRegex.exec(item.text());
      const earnMinMatch = earnMinimumRegex.exec(item.text());

      // If the current target has nested information
      if (item.find('ul').length) {
        const nestedReq: NestedPreCoRequisites = {};

        // If the nested requisites require a certain quantity
        // i.e. "Complete X of the following:"
        if (quantityRegex.test(item.text()) && quantityMatch?.groups) {
          if (quantityMatch.groups.quantity === 'all') {
            nestedReq.quantity = 'ALL';
          } else {
            nestedReq.quantity = Number(quantityMatch.groups.quantity);
          }
          if (quantityMatch.groups.coreq) {
            nestedReq.coreq = true;
          }
          if (quantityMatch.groups.units) {
            nestedReq.units = true;
          }
        }
        // Else if the nested requisites require a minimum
        // i.e. "Earned a minimum GPA of X in Y"
        else if (earnMinimumRegex.test(item.text()) && earnMinMatch?.groups) {
          if (earnMinMatch.groups.quantity) {
            if (earnMinMatch.groups.quantity === 'all') {
              nestedReq.quantity = 'ALL';
            } else {
              nestedReq.quantity = Number(earnMinMatch.groups.quantity);
            }
          } else {
            nestedReq.quantity = 'ALL';
          }
          // add grade or gpa values to nestedReq object
          nestedReq[earnMinMatch.groups.unit.toLowerCase() as 'grade' | 'gpa'] = earnMinMatch.groups.min;
        } else {
          nestedReq.unparsed = item.text();
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        nestedReq.reqList = parsePreCoReqs(item.html()!);
        reqs.push(nestedReq);
      } else {
        // If it finds a UVic course as the req
        if (item.find('a').length) {
          const course: Course = { subject: '', code: '' };

          const courseText = item.find('a').text();
          const courseMatch = courseRegex.exec(courseText);

          if (courseRegex.test(courseText) && courseMatch?.groups) {
            course.subject = courseMatch.groups.subject;
            course.code = courseMatch.groups.code;
            reqs.push(course);
          }
        }
        // Any other possible reqs
        else {
          reqs.push(item.text());
        }
      }
    });

  return reqs;
}

function set_hoursCatalog(hours: string[]){
  var each_hour: {lecture: string, lab: string, tutorial: string}[];
  each_hour=[];
  
  //store the hours in a new array.
  hours.forEach(element => {
    let temp=element.split('-');
    let JSON_value = {lecture: temp[0], lab: temp[1], tutorial: temp[2]};
    each_hour= each_hour.concat(JSON_value);
  });

  return each_hour; 
}

export function KualiCourseItemParser(course: KualiCourseItem): KualiCourseItemParsed {
  // strip HTML tags from courseDetails.description
  course.description = course.description.replace(/(<([^>]+)>)/gi, '');

  const { hoursCatalogText, preAndCorequisites, preOrCorequisites } = course;
  
  //split the hours if we have more than one. 
  let hours = hoursCatalogText?.split(' or ');

  return {
    ...course,
    hoursCatalog: hours ?  set_hoursCatalog(hours) : undefined,
    preAndCorequisites: preAndCorequisites ? parsePreCoReqs(preAndCorequisites) : undefined,
    preOrCorequisites: preOrCorequisites ? parsePreCoReqs(preOrCorequisites) : undefined,
  };
}
