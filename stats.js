function calculateStats(donations) {

  let totalAmount = 0;
  let largestDonation = 0;

  donations.forEach(donation => {

    const amount = Number(donation.amount) || 0;

    totalAmount += amount;

    if(amount > largestDonation){
      largestDonation = amount;
    }

  });

  const averageDonation =
    donations.length > 0
      ? (totalAmount / donations.length).toFixed(2)
      : 0;

  return {
    totalDonations: donations.length,
    totalAmount,
    averageDonation,
    largestDonation,
    totalDonors: donations.length
  };

}
